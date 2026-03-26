from __future__ import annotations

from uuid import UUID

from flask import Blueprint, g, jsonify, request
from pydantic import BaseModel, Field, ValidationError

from app.auth import jwt_required, role_required
from app.database import db
from app.models import Trip, GpsPing

gps_ping_bp = Blueprint("gps_ping_api", __name__, url_prefix="/api")


class GpsPingCreateRequest(BaseModel):
    trip_id: UUID
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    speed_kmh: float | None = Field(default=None, ge=0)
    heading: float | None = Field(default=None, ge=0, le=360)
    accuracy_m: float | None = Field(default=None, ge=0)
    nearest_stop_id: UUID | None = None


# ── READ — open to everyone (passengers need live positions) ─────────────

@gps_ping_bp.get("/gps-pings")
def list_gps_pings():
    """Return pings for a trip. Requires ?trip_id= query param."""
    trip_id = request.args.get("trip_id")
    if not trip_id:
        return jsonify({"error": "trip_id query parameter is required"}), 400

    try:
        trip_uuid = UUID(trip_id)
    except ValueError:
        return jsonify({"error": "invalid_trip_id"}), 400

    limit = request.args.get("limit", 100, type=int)
    pings = (
        GpsPing.query
        .filter_by(trip_id=trip_uuid)
        .order_by(GpsPing.timestamp.desc())
        .limit(min(limit, 1000))
        .all()
    )
    return jsonify([p.to_dict() for p in pings]), 200


@gps_ping_bp.get("/gps-pings/latest")
def latest_ping():
    """Return the single most recent ping for a trip."""
    trip_id = request.args.get("trip_id")
    if not trip_id:
        return jsonify({"error": "trip_id query parameter is required"}), 400

    try:
        trip_uuid = UUID(trip_id)
    except ValueError:
        return jsonify({"error": "invalid_trip_id"}), 400

    ping = (
        GpsPing.query
        .filter_by(trip_id=trip_uuid)
        .order_by(GpsPing.timestamp.desc())
        .first()
    )
    if not ping:
        return jsonify({"error": "no_pings_found"}), 404
    return jsonify(ping.to_dict()), 200


# ── WRITE — admin/driver only ───────────────────────────────────────────

@gps_ping_bp.post("/gps-pings")
@jwt_required()
def create_gps_ping():
    current_user = g.current_user or {}
    role = current_user.get("role")

    if role not in ("admin", "driver"):
        return jsonify({"error": "forbidden"}), 403

    payload = request.get_json(silent=True) or {}
    try:
        validated = GpsPingCreateRequest.model_validate(payload)
    except ValidationError as exc:
        return jsonify({"error": "validation_error", "details": exc.errors()}), 400

    trip = db.session.get(Trip, validated.trip_id)
    if not trip:
        return jsonify({"error": "trip_not_found"}), 404

    if str(trip.assigned_to) != current_user.get("user_id"):
        return jsonify({"error": "forbidden"}), 403

    ping = GpsPing(
        trip_id=validated.trip_id,
        latitude=validated.latitude,
        longitude=validated.longitude,
        speed_kmh=validated.speed_kmh,
        heading=validated.heading,
        accuracy_m=validated.accuracy_m,
        nearest_stop_id=validated.nearest_stop_id,
    )
    db.session.add(ping)
    db.session.commit()
    return jsonify(ping.to_dict()), 201
