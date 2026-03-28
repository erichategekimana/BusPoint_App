"""
GPS Simulator — generates realistic bus_location updates for in-progress trips.

For every trip with status='in_progress', the simulator:
  1. Reads the cached route_geometry (detailed road polyline from ORS).
  2. Computes cumulative distances along the polyline.
  3. Based on elapsed time since departure, finds the current position
     along the polyline and interpolates between the two nearest points.
  4. Computes realistic speed (km/h) and heading (degrees).
  5. Upserts the bus_locations row so the frontend map picks it up.

The scheduler calls `tick()` every ~10 seconds.
"""
from __future__ import annotations

import json
import logging
import math
import random
from datetime import datetime, timezone

from app.database import db
from app.models import BusLocation, RouteStop, Trip

log = logging.getLogger(__name__)


# ── Geo helpers ──────────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points in kilometres."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Initial bearing from point 1 → point 2 in degrees [0, 360)."""
    dlon = math.radians(lon2 - lon1)
    lat1r, lat2r = math.radians(lat1), math.radians(lat2)
    x = math.sin(dlon) * math.cos(lat2r)
    y = (math.cos(lat1r) * math.sin(lat2r)
         - math.sin(lat1r) * math.cos(lat2r) * math.cos(dlon))
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def _lerp(a: float, b: float, t: float) -> float:
    """Linear interpolation between a and b by factor t in [0, 1]."""
    return a + (b - a) * t


# ── Core simulation logic ───────────────────────────────────────────────────

def _get_total_minutes(trip) -> float:
    """Get total route duration from route_stops estimated_minutes_from_start."""
    last_rs = (
        RouteStop.query
        .filter_by(route_id=trip.route_id)
        .order_by(RouteStop.stop_order.desc())
        .first()
    )
    if last_rs and last_rs.estimated_minutes_from_start:
        return float(last_rs.estimated_minutes_from_start)
    return 45.0  # fallback


def _build_cumulative_distances(coords: list[list[float]]) -> list[float]:
    """
    Given [[lng, lat], ...], return cumulative distances in km.
    Result[0] = 0.0, Result[i] = total distance from start to point i.
    """
    dists = [0.0]
    for i in range(1, len(coords)):
        prev_lng, prev_lat = coords[i - 1]
        cur_lng, cur_lat = coords[i]
        seg = _haversine_km(prev_lat, prev_lng, cur_lat, cur_lng)
        dists.append(dists[-1] + seg)
    return dists


def _simulate_trip(trip) -> None:
    """Update bus_location for a single in-progress trip."""
    # Parse the cached route geometry
    if not trip.route_geometry:
        return
    try:
        coords = json.loads(trip.route_geometry)  # [[lng, lat], ...]
    except (json.JSONDecodeError, TypeError):
        return

    if len(coords) < 2:
        return

    # Build cumulative distance array
    cum_dists = _build_cumulative_distances(coords)
    total_distance = cum_dists[-1]
    if total_distance <= 0:
        return

    # Calculate progress based on elapsed time
    now = datetime.now(timezone.utc)
    departure = trip.departure_time
    if departure.tzinfo is None:
        departure = departure.replace(tzinfo=timezone.utc)

    elapsed_minutes = (now - departure).total_seconds() / 60.0
    total_minutes = _get_total_minutes(trip)

    # Clamp progress to [0, 1]
    progress = max(0.0, min(1.0, elapsed_minutes / total_minutes))

    # Find position along the polyline at this progress
    target_dist = progress * total_distance

    # Binary-style search for the segment containing target_dist
    seg_idx = 0
    for i in range(1, len(cum_dists)):
        if cum_dists[i] >= target_dist:
            seg_idx = i - 1
            break
    else:
        seg_idx = len(coords) - 2

    # Interpolate within the segment
    seg_start_dist = cum_dists[seg_idx]
    seg_end_dist = cum_dists[seg_idx + 1]
    seg_length = seg_end_dist - seg_start_dist

    if seg_length > 0:
        seg_t = (target_dist - seg_start_dist) / seg_length
    else:
        seg_t = 0.0

    lng1, lat1 = coords[seg_idx]
    lng2, lat2 = coords[seg_idx + 1]

    lat = _lerp(lat1, lat2, seg_t)
    lng = _lerp(lng1, lng2, seg_t)

    # Add tiny random jitter (approx 3 metres) to look realistic
    lat += random.uniform(-0.00003, 0.00003)
    lng += random.uniform(-0.00003, 0.00003)

    # Compute heading (bearing along this segment of the road)
    heading = _bearing(lat1, lng1, lat2, lng2)

    # Compute speed from overall route distance / total time
    avg_speed = (total_distance / (total_minutes / 60.0)) if total_minutes > 0 else 30.0
    # Add variation: +-15%
    speed_kmh = round(avg_speed * random.uniform(0.85, 1.15), 1)
    speed_kmh = max(0.0, speed_kmh)

    # Auto-complete trip when bus reaches the end
    if progress >= 1.0:
        trip.status = "completed"
        trip.arrival_time = now
        # Remove bus location so it disappears from map
        BusLocation.query.filter_by(bus_id=trip.bus_id).delete()
        db.session.commit()
        log.info("Trip %s auto-completed (bus reached end of route)", trip.id)
        return

    # Upsert bus_location — one row per bus (unique constraint on bus_id)
    location = BusLocation.query.filter_by(bus_id=trip.bus_id).first()
    if location:
        location.trip_id = trip.id
        location.latitude = round(lat, 8)
        location.longitude = round(lng, 8)
        location.speed = speed_kmh
        location.heading = round(heading, 1)
        location.last_updated = now
    else:
        location = BusLocation(
            bus_id=trip.bus_id,
            trip_id=trip.id,
            latitude=round(lat, 8),
            longitude=round(lng, 8),
            speed=speed_kmh,
            heading=round(heading, 1),
        )
        db.session.add(location)

    db.session.commit()
    log.debug("Simulated bus %s at (%.6f, %.6f) — %.0f%% along route",
              trip.bus_id, lat, lng, progress * 100)


# ── Public entry point (called by the scheduler) ────────────────────────────

def tick(app) -> None:
    """Advance all in-progress trips by one simulation step."""
    with app.app_context():
        trips = Trip.query.filter_by(status="in_progress").all()
        for trip in trips:
            try:
                _simulate_trip(trip)
            except Exception:
                db.session.rollback()
                log.exception("GPS simulation error for trip %s", trip.id)
