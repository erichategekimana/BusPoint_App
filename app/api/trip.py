from __future__ import annotations

from datetime import datetime
from uuid import UUID

from flask import Blueprint, g, jsonify, request
from pydantic import BaseModel, Field, ValidationError

from app.auth import jwt_required, role_required
from app.database import db
from app.models import Bus, Route, Trip, User


trip_bp = Blueprint("trip_api", __name__, url_prefix="/api")


class TripCreateRequest(BaseModel):
    bus_id: UUID
    route_id: UUID
    departure_time: datetime
    current_capacity: int = Field(ge=0)
    assigned_to: UUID | None = None
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


# ── READ endpoints — open to everyone ──────────────────────────────────────

@trip_bp.get("/trips")
def list_trips():
    bus_id = request.args.get("bus_id")
    route_id = request.args.get("route_id")
    assigned_to = request.args.get("assigned_to")
    status = request.args.get("status")

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

    # Admin is auto-assigned; can optionally assign another admin
    if validated.assigned_to:
        target_user = db.session.get(User, validated.assigned_to)
        if not target_user:
            return jsonify({"error": "user_not_found"}), 404
        if target_user.role != "admin":
            return jsonify({"error": "user_is_not_an_admin"}), 422
        effective_assigned_to = validated.assigned_to
    else:
        effective_assigned_to = UUID(current_user.get("user_id"))

    trip = Trip(
        bus_id=validated.bus_id,
        route_id=validated.route_id,
        departure_time=validated.departure_time,
        current_capacity=validated.current_capacity,
        assigned_to=effective_assigned_to,
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

    if role != "admin":
        return jsonify({"error": "forbidden"}), 403

    trip_uuid, error = parse_uuid(trip_id, "trip_id")
    if error:
        return error
    trip = db.session.get(Trip, trip_uuid)
    if not trip:
        return jsonify({"error": "trip_not_found"}), 404

    # Admin can only edit their own assigned trip
    if str(trip.assigned_to) != current_user.get("user_id"):
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
        if target_user.role != "admin":
            return jsonify({"error": "user_is_not_an_admin"}), 422

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
        trip.status = validated.status
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

    # Admin can only delete their own trip
    if str(trip.assigned_to) != current_user.get("user_id"):
        return jsonify({"error": "forbidden"}), 403

    db.session.delete(trip)
    db.session.commit()
    return jsonify({"status": "deleted"}), 200
