"""
OpenRouteService integration — fetches real road geometry for a list of waypoints.

Calls the ORS Directions API (driving-car profile) and returns a detailed
list of [longitude, latitude] coordinate pairs that follow actual roads.
"""
from __future__ import annotations

import json
import logging

import requests
from flask import current_app

from app.database import db
from app.models import RouteStop, Stop

log = logging.getLogger(__name__)


def _get_ordered_waypoints(route_id) -> list[list[float]]:
    """Return [[lng, lat], ...] for all stops on the route, ordered."""
    route_stops = (
        RouteStop.query
        .filter_by(route_id=route_id)
        .order_by(RouteStop.stop_order.asc())
        .all()
    )
    waypoints = []
    for rs in route_stops:
        stop = db.session.get(Stop, rs.stop_id)
        if stop:
            waypoints.append([float(stop.longitude), float(stop.latitude)])
    return waypoints


def fetch_route_geometry(route_id) -> list[list[float]] | None:
    """
    Call ORS Directions API with the route's stops as waypoints.
    Returns a list of [longitude, latitude] pairs following real roads,
    or None on failure.
    """
    api_key = current_app.config.get("ORS_API_KEY", "")
    if not api_key:
        log.warning("ORS_API_KEY not configured — falling back to straight-line geometry")
        return _straight_line_fallback(route_id)

    waypoints = _get_ordered_waypoints(route_id)
    if len(waypoints) < 2:
        log.warning("Route %s has fewer than 2 stops — cannot fetch geometry", route_id)
        return None

    try:
        resp = requests.post(
            "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
            headers={
                "Authorization": api_key,
                "Content-Type": "application/json",
            },
            json={"coordinates": waypoints},
            timeout=15,
        )

        if resp.status_code != 200:
            log.error("ORS API error %s: %s", resp.status_code, resp.text[:300])
            return _straight_line_fallback(route_id)

        data = resp.json()
        # ORS returns GeoJSON FeatureCollection → first feature → geometry → coordinates
        coords = data["features"][0]["geometry"]["coordinates"]
        # coords is [[lng, lat], [lng, lat], ...]
        log.info("ORS returned %d coordinate pairs for route %s", len(coords), route_id)
        return coords

    except Exception:
        log.exception("Failed to fetch ORS route geometry for route %s", route_id)
        return _straight_line_fallback(route_id)


def _straight_line_fallback(route_id) -> list[list[float]] | None:
    """If ORS is unavailable, return stop coordinates as-is (straight lines)."""
    waypoints = _get_ordered_waypoints(route_id)
    return waypoints if len(waypoints) >= 2 else None
