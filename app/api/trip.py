from __future__ import annotations

from datetime import datetime
from uuid import UUID

from flask import Blueprint, g, jsonify, request
from pydantic import BaseModel, Field, ValidationError

import json

from app.auth import jwt_required, role_required
from app.database import db
from app.models import Bus, BusLocation, Route, RouteStop, Stop, Trip, User
from app.ors_service import fetch_route_geometry


trip_bp = Blueprint("trip_api", __name__, url_prefix="/api")


class TripCreateRequest(BaseModel):
    bus_id: UUID
    route_id: UUID
    departure_time: datetime
    current_capacity: int = Field(ge=0)
    assigned_to: UUID
    arrival_time: datetime | None = None
    status: str | None = None


class TripUpdateRequest(BaseModel):
    bus_id: UUID | None = None
    route_id: UUID | None = None
    assigned_to: UUID | None = None
    departure_time: datetime | None = None
    arrival_time: datetime | None = None
    status: str | None = None
    current_capacity: int | None = Field(default=None, ge=0)


def parse_uuid(raw_value: str, field_name: str):
    try:
        return UUID(raw_value), None
    except ValueError:
        return None, (jsonify({"error": f"invalid_{field_name}"}), 400)


def model_errors(errors: list[dict]) -> tuple:
    return jsonify({"error": "validation_error", "details": errors}), 400


def validate_payload(schema, payload: dict):
    try:
        return schema.model_validate(payload), None
    except ValidationError as exc:
        return None, model_errors(exc.errors())


def _seed_bus_location(trip: Trip) -> None:
    """Fetch ORS road geometry, cache it, and create initial bus_location."""
    # Fetch real road geometry from OpenRouteService
    coords = fetch_route_geometry(trip.route_id)
    if coords and len(coords) >= 2:
        trip.route_geometry = json.dumps(coords)
        start_lng, start_lat = coords[0]
    else:
        # Fallback: use first stop coordinates
        first_rs = (
            RouteStop.query
            .filter_by(route_id=trip.route_id)
            .order_by(RouteStop.stop_order.asc())
            .first()
        )
        if not first_rs:
            return
        stop = db.session.get(Stop, first_rs.stop_id)
        if not stop:
            return
        start_lat = float(stop.latitude)
        start_lng = float(stop.longitude)

    # Remove any stale location for this bus
    BusLocation.query.filter_by(bus_id=trip.bus_id).delete()

    location = BusLocation(
        bus_id=trip.bus_id,
        trip_id=trip.id,
        latitude=start_lat,
        longitude=start_lng,
        speed=0,
        heading=0,
    )
    db.session.add(location)


def _remove_bus_location(trip: Trip) -> None:
    """Delete the bus_location row when the trip ends."""
    BusLocation.query.filter_by(bus_id=trip.bus_id).delete()


def _get_admin_company(current_user: dict) -> str | None:
    """Return the company of the current admin user."""
    user = db.session.get(User, UUID(current_user.get("user_id")))
    return user.company if user else None


def _trip_belongs_to_company(trip: Trip, company: str | None) -> bool:
    """Check if the trip's assigned driver belongs to the same company."""
    if not company or not trip.assigned_to:
        return False
    assignee = db.session.get(User, trip.assigned_to)
    return assignee is not None and assignee.company == company


# ── READ endpoints — open to everyone ──────────────────────────────────────

@trip_bp.get("/trips")
def list_trips():
    bus_id = request.args.get("bus_id")
    route_id = request.args.get("route_id")
    assigned_to = request.args.get("assigned_to")
    status = request.args.get("status")
    company = request.args.get("company")

    query = Trip.query
    if bus_id:
        bus_uuid, error = parse_uuid(bus_id, "bus_id")
        if error:
            return error
        query = query.filter(Trip.bus_id == bus_uuid)
    if route_id:
        route_uuid, error = parse_uuid(route_id, "route_id")
        if error:
            return error
        query = query.filter(Trip.route_id == route_uuid)
    if assigned_to:
        assigned_uuid, error = parse_uuid(assigned_to, "assigned_to")
        if error:
            return error
        query = query.filter(Trip.assigned_to == assigned_uuid)
    if status:
        query = query.filter(Trip.status == status)

    trips = query.order_by(Trip.departure_time.asc()).all()

    # Filter by company: keep trips whose assigned driver belongs to the company
    if company:
        filtered = []
        for t in trips:
            if t.assigned_to:
                assignee = db.session.get(User, t.assigned_to)
                if assignee and assignee.company == company:
                    filtered.append(t)
        trips = filtered

    return jsonify([trip.to_dict() for trip in trips]), 200


@trip_bp.get("/trips/<trip_id>")
def get_trip(trip_id: str):
    trip_uuid, error = parse_uuid(trip_id, "trip_id")
    if error:
        return error
    trip = db.session.get(Trip, trip_uuid)
    if not trip:
        return jsonify({"error": "trip_not_found"}), 404
    return jsonify(trip.to_dict()), 200


@trip_bp.get("/trips/<trip_id>/geometry")
def get_trip_geometry(trip_id: str):
    """Return the cached ORS road geometry for a trip (public, used by maps)."""
    trip_uuid, error = parse_uuid(trip_id, "trip_id")
    if error:
        return error
    trip = db.session.get(Trip, trip_uuid)
    if not trip:
        return jsonify({"error": "trip_not_found"}), 404

    if not trip.route_geometry:
        return jsonify({"coordinates": [], "stops": []}), 200

    try:
        coordinates = json.loads(trip.route_geometry)
    except (json.JSONDecodeError, TypeError):
        coordinates = []

    # Also return stop info for markers
    route_stops = (
        RouteStop.query
        .filter_by(route_id=trip.route_id)
        .order_by(RouteStop.stop_order.asc())
        .all()
    )
    stops = []
    for rs in route_stops:
        stop = db.session.get(Stop, rs.stop_id)
        if stop:
            stops.append({
                "name": stop.name,
                "latitude": float(stop.latitude),
                "longitude": float(stop.longitude),
                "stop_order": rs.stop_order,
                "estimated_minutes": rs.estimated_minutes_from_start,
            })

    return jsonify({"coordinates": coordinates, "stops": stops}), 200


# ── WRITE endpoints ─────────────────────────────────────────────────────────

@trip_bp.post("/trips")
@jwt_required()
def create_trip():
    current_user = g.current_user or {}
    role = current_user.get("role")

    if role != "admin":
        return jsonify({"error": "forbidden"}), 403

    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(TripCreateRequest, payload)
    if error:
        return error

    if not db.session.get(Bus, validated.bus_id):
        return jsonify({"error": "bus_not_found"}), 404
    if not db.session.get(Route, validated.route_id):
        return jsonify({"error": "route_not_found"}), 404

    # Must assign to a driver (admin cannot assign to themselves)
    target_user = db.session.get(User, validated.assigned_to)
    if not target_user:
        return jsonify({"error": "user_not_found"}), 404
    if target_user.role != "driver":
        return jsonify({"error": "trip_must_be_assigned_to_a_driver"}), 422

    # Driver must belong to the same company as the admin
    admin_company = _get_admin_company(current_user)
    if not admin_company or target_user.company != admin_company:
        return jsonify({"error": "driver_not_in_your_company"}), 422

    trip = Trip(
        bus_id=validated.bus_id,
        route_id=validated.route_id,
        departure_time=validated.departure_time,
        current_capacity=validated.current_capacity,
        assigned_to=validated.assigned_to,
    )
    if validated.arrival_time is not None:
        trip.arrival_time = validated.arrival_time
    if validated.status is not None:
        trip.status = validated.status

    db.session.add(trip)
    db.session.commit()
    return jsonify(trip.to_dict()), 201


@trip_bp.patch("/trips/<trip_id>")
@jwt_required()
def update_trip(trip_id: str):
    current_user = g.current_user or {}
    role = current_user.get("role")

    if role not in ("admin", "driver"):
        return jsonify({"error": "forbidden"}), 403

    trip_uuid, error = parse_uuid(trip_id, "trip_id")
    if error:
        return error
    trip = db.session.get(Trip, trip_uuid)
    if not trip:
        return jsonify({"error": "trip_not_found"}), 404

    # Drivers can only update their own assigned trip's status
    if role == "driver":
        if str(trip.assigned_to) != current_user.get("user_id"):
            return jsonify({"error": "forbidden"}), 403
        payload = request.get_json(silent=True) or {}
        new_status = payload.get("status")
        if not new_status:
            return jsonify({"error": "drivers_may_only_update_status"}), 403
        allowed_transitions = {
            "scheduled": ["in_progress"],
            "in_progress": ["completed"],
        }
        if new_status not in allowed_transitions.get(trip.status, []):
            return jsonify({"error": f"cannot_transition_from_{trip.status}_to_{new_status}"}), 422
        trip.status = new_status
        # Seed or clean up simulated GPS location
        if new_status == "in_progress":
            _seed_bus_location(trip)
        elif new_status == "completed":
            _remove_bus_location(trip)
        db.session.commit()
        return jsonify(trip.to_dict()), 200

    # Admin: can manage any trip whose driver is in their company
    admin_company = _get_admin_company(current_user)
    if not _trip_belongs_to_company(trip, admin_company):
        return jsonify({"error": "forbidden"}), 403

    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(TripUpdateRequest, payload)
    if error:
        return error

    if validated.bus_id and not db.session.get(Bus, validated.bus_id):
        return jsonify({"error": "bus_not_found"}), 404
    if validated.route_id and not db.session.get(Route, validated.route_id):
        return jsonify({"error": "route_not_found"}), 404
    if validated.assigned_to:
        target_user = db.session.get(User, validated.assigned_to)
        if not target_user:
            return jsonify({"error": "user_not_found"}), 404
        if target_user.role != "driver":
            return jsonify({"error": "trip_must_be_assigned_to_a_driver"}), 422
        if target_user.company != admin_company:
            return jsonify({"error": "driver_not_in_your_company"}), 422

    if validated.bus_id is not None:
        trip.bus_id = validated.bus_id
    if validated.route_id is not None:
        trip.route_id = validated.route_id
    if validated.assigned_to is not None:
        trip.assigned_to = validated.assigned_to
    if validated.departure_time is not None:
        trip.departure_time = validated.departure_time
    if validated.arrival_time is not None:
        trip.arrival_time = validated.arrival_time
    if validated.status is not None:
        old_status = trip.status
        trip.status = validated.status
        # Seed or clean up simulated GPS location on status change
        if validated.status == "in_progress" and old_status != "in_progress":
            _seed_bus_location(trip)
        elif validated.status in ("completed", "cancelled") and old_status == "in_progress":
            _remove_bus_location(trip)
    if validated.current_capacity is not None:
        trip.current_capacity = validated.current_capacity

    db.session.commit()
    return jsonify(trip.to_dict()), 200


@trip_bp.delete("/trips/<trip_id>")
@jwt_required()
def delete_trip(trip_id: str):
    current_user = g.current_user or {}
    role = current_user.get("role")

    if role != "admin":
        return jsonify({"error": "forbidden"}), 403

    trip_uuid, error = parse_uuid(trip_id, "trip_id")
    if error:
        return error
    trip = db.session.get(Trip, trip_uuid)
    if not trip:
        return jsonify({"error": "trip_not_found"}), 404

    # Admin can only delete trips where the driver is in their company
    admin_company = _get_admin_company(current_user)
    if not _trip_belongs_to_company(trip, admin_company):
        return jsonify({"error": "forbidden"}), 403

    _remove_bus_location(trip)
    db.session.delete(trip)
    db.session.commit()
    return jsonify({"status": "deleted"}), 200
