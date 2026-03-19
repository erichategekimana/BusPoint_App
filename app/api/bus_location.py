from __future__ import annotations

from uuid import UUID

from flask import Blueprint, g, jsonify, request
from pydantic import BaseModel, Field, ValidationError

from app.auth import jwt_required, role_required
from app.database import db
from app.models import Bus, BusLocation, Trip


bus_location_bp = Blueprint("bus_location_api", __name__, url_prefix="/api")


class BusLocationCreateRequest(BaseModel):
    bus_id: UUID
    trip_id: UUID
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    speed: float | None = None
    heading: float | None = Field(default=None, ge=0, le=360)


class BusLocationUpdateRequest(BaseModel):
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    speed: float | None = None
    heading: float | None = Field(default=None, ge=0, le=360)


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


def bus_location_to_dict(location: BusLocation) -> dict:
    return {
        "id": str(location.id),
        "bus_id": str(location.bus_id),
        "trip_id": str(location.trip_id),
        "latitude": float(location.latitude),
        "longitude": float(location.longitude),
        "speed": float(location.speed) if location.speed is not None else None,
        "heading": float(location.heading) if location.heading is not None else None,
        "captured_at": location.captured_at.isoformat() if location.captured_at else None,
    }


# ── READ endpoints — open to everyone ──────────────────────────────────────
# Passengers need live bus positions; no auth required.

@bus_location_bp.get("/bus-locations")
def list_bus_locations():
    bus_id = request.args.get("bus_id")
    trip_id = request.args.get("trip_id")

    query = BusLocation.query
    if bus_id:
        bus_uuid, error = parse_uuid(bus_id, "bus_id")
        if error:
            return error
        query = query.filter(BusLocation.bus_id == bus_uuid)
    if trip_id:
        trip_uuid, error = parse_uuid(trip_id, "trip_id")
        if error:
            return error
        query = query.filter(BusLocation.trip_id == trip_uuid)

    locations = query.order_by(BusLocation.captured_at.desc()).all()
    return jsonify([bus_location_to_dict(loc) for loc in locations]), 200


@bus_location_bp.get("/bus-locations/<location_id>")
def get_bus_location(location_id: str):
    location_uuid, error = parse_uuid(location_id, "location_id")
    if error:
        return error
    location = db.session.get(BusLocation, location_uuid)
    if not location:
        return jsonify({"error": "bus_location_not_found"}), 404
    return jsonify(bus_location_to_dict(location)), 200


# ── WRITE endpoints — driver (own trip) or admin ────────────────────────────

@bus_location_bp.post("/bus-locations")
@jwt_required()
def create_bus_location():
    current_user = g.current_user or {}
    role = current_user.get("role")

    if role not in ("admin", "driver"):
        return jsonify({"error": "forbidden"}), 403

    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(BusLocationCreateRequest, payload)
    if error:
        return error

    if not db.session.get(Bus, validated.bus_id):
        return jsonify({"error": "bus_not_found"}), 404

    trip = db.session.get(Trip, validated.trip_id)
    if not trip:
        return jsonify({"error": "trip_not_found"}), 404

    # Driver can only post location for a trip they are assigned to
    if role == "driver" and str(trip.driver_id) != current_user.get("user_id"):
        return jsonify({"error": "forbidden"}), 403

    location = BusLocation(
        bus_id=validated.bus_id,
        trip_id=validated.trip_id,
        latitude=validated.latitude,
        longitude=validated.longitude,
    )
    if validated.speed is not None:
        location.speed = validated.speed
    if validated.heading is not None:
        location.heading = validated.heading

    db.session.add(location)
    db.session.commit()
    return jsonify(bus_location_to_dict(location)), 201


@bus_location_bp.patch("/bus-locations/<location_id>")
@jwt_required()
def update_bus_location(location_id: str):
    current_user = g.current_user or {}
    role = current_user.get("role")

    if role not in ("admin", "driver"):
        return jsonify({"error": "forbidden"}), 403

    location_uuid, error = parse_uuid(location_id, "location_id")
    if error:
        return error
    location = db.session.get(BusLocation, location_uuid)
    if not location:
        return jsonify({"error": "bus_location_not_found"}), 404

    # Driver can only update a location record that belongs to their trip
    if role == "driver":
        trip = db.session.get(Trip, location.trip_id)
        if not trip or str(trip.driver_id) != current_user.get("user_id"):
            return jsonify({"error": "forbidden"}), 403

    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(BusLocationUpdateRequest, payload)
    if error:
        return error

    if validated.latitude is not None:
        location.latitude = validated.latitude
    if validated.longitude is not None:
        location.longitude = validated.longitude
    if validated.speed is not None:
        location.speed = validated.speed
    if validated.heading is not None:
        location.heading = validated.heading

    db.session.commit()
    return jsonify(bus_location_to_dict(location)), 200


@bus_location_bp.delete("/bus-locations/<location_id>")
@jwt_required()
@role_required("admin")
def delete_bus_location(location_id: str):
    location_uuid, error = parse_uuid(location_id, "location_id")
    if error:
        return error
    location = db.session.get(BusLocation, location_uuid)
    if not location:
        return jsonify({"error": "bus_location_not_found"}), 404
    db.session.delete(location)
    db.session.commit()
    return jsonify({"status": "deleted"}), 200
