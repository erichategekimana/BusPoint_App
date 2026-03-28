from __future__ import annotations

import secrets
from datetime import datetime
from uuid import UUID

from flask import Blueprint, g, jsonify, request
from pydantic import BaseModel, Field, ValidationError

from app.auth import jwt_required, role_required
from app.database import db
from app.models import Booking, Stop, Trip, User


booking_bp = Blueprint("booking_api", __name__, url_prefix="/api")


class BookingCreateRequest(BaseModel):
    trip_id: UUID
    pickup_stop_id: UUID
    dropoff_stop_id: UUID
    seat_number: int | None = Field(default=None, ge=1)
    # user_id only respected when sent by an admin; passengers use token identity
    user_id: UUID | None = None


class BookingUpdateRequest(BaseModel):
    status: str | None = None
    seat_number: int | None = Field(default=None, ge=1)
    boarded_at: str | None = None


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


# ── READ endpoints ──────────────────────────────────────────────────────────
# Admin sees all; passengers see only their own bookings.

@booking_bp.get("/bookings")
@jwt_required()
def list_bookings():
    current_user = g.current_user or {}
    role = current_user.get("role")
    trip_id = request.args.get("trip_id")
    status = request.args.get("status")

    query = Booking.query

    if role == "admin":
        user_id_filter = request.args.get("user_id")
        if user_id_filter:
            user_uuid, error = parse_uuid(user_id_filter, "user_id")
            if error:
                return error
            query = query.filter(Booking.user_id == user_uuid)
    else:
        own_uuid = UUID(current_user.get("user_id"))
        query = query.filter(Booking.user_id == own_uuid)

    if trip_id:
        trip_uuid, error = parse_uuid(trip_id, "trip_id")
        if error:
            return error
        query = query.filter(Booking.trip_id == trip_uuid)
    if status:
        query = query.filter(Booking.status == status)

    bookings = query.order_by(Booking.created_at.desc()).all()
    return jsonify([booking.to_dict() for booking in bookings]), 200


@booking_bp.get("/bookings/<booking_id>")
@jwt_required()
def get_booking(booking_id: str):
    current_user = g.current_user or {}
    booking_uuid, error = parse_uuid(booking_id, "booking_id")
    if error:
        return error
    booking = db.session.get(Booking, booking_uuid)
    if not booking:
        return jsonify({"error": "booking_not_found"}), 404
    if current_user.get("role") != "admin" and str(booking.user_id) != current_user.get("user_id"):
        return jsonify({"error": "forbidden"}), 403
    return jsonify(booking.to_dict()), 200


# ── WRITE endpoints ─────────────────────────────────────────────────────────

@booking_bp.post("/bookings")
@jwt_required()
def create_booking():
    current_user = g.current_user or {}
    role = current_user.get("role")

    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(BookingCreateRequest, payload)
    if error:
        return error

    # Resolve the user_id: admin may specify one; everyone else books for themselves
    if role == "admin" and validated.user_id:
        target_user_id = validated.user_id
    else:
        target_user_id = UUID(current_user.get("user_id"))

    if not db.session.get(User, target_user_id):
        return jsonify({"error": "user_not_found"}), 404
    trip = db.session.get(Trip, validated.trip_id)
    if not trip:
        return jsonify({"error": "trip_not_found"}), 404
    if trip.status in ("completed", "cancelled"):
        return jsonify({"error": "cannot_book_a_trip_that_is_" + trip.status}), 422
    if not db.session.get(Stop, validated.pickup_stop_id):
        return jsonify({"error": "pickup_stop_not_found"}), 404
    if not db.session.get(Stop, validated.dropoff_stop_id):
        return jsonify({"error": "dropoff_stop_not_found"}), 404

    booking = Booking(
        user_id=target_user_id,
        trip_id=validated.trip_id,
        pickup_stop_id=validated.pickup_stop_id,
        dropoff_stop_id=validated.dropoff_stop_id,
        seat_number=validated.seat_number,
        ticket_token=secrets.token_urlsafe(32),
    )
    db.session.add(booking)
    db.session.commit()
    return jsonify(booking.to_dict()), 201


@booking_bp.patch("/bookings/<booking_id>")
@jwt_required()
def update_booking(booking_id: str):
    current_user = g.current_user or {}
    role = current_user.get("role")

    booking_uuid, error = parse_uuid(booking_id, "booking_id")
    if error:
        return error
    booking = db.session.get(Booking, booking_uuid)
    if not booking:
        return jsonify({"error": "booking_not_found"}), 404

    # Passengers may only cancel their own booking
    if role != "admin":
        if str(booking.user_id) != current_user.get("user_id"):
            return jsonify({"error": "forbidden"}), 403
        payload = request.get_json(silent=True) or {}
        if payload.get("status") != "cancelled":
            return jsonify({"error": "passengers_may_only_cancel"}), 403
        booking.status = "cancelled"
        db.session.commit()
        return jsonify(booking.to_dict()), 200

    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(BookingUpdateRequest, payload)
    if error:
        return error

    if validated.status is not None:
        booking.status = validated.status
    if validated.seat_number is not None:
        booking.seat_number = validated.seat_number
    if validated.boarded_at is not None:
        booking.boarded_at = datetime.fromisoformat(validated.boarded_at)

    db.session.commit()
    return jsonify(booking.to_dict()), 200


@booking_bp.post("/bookings/verify")
@jwt_required()
@role_required("admin", "driver")
def verify_ticket():
    """Scan a ticket token: validate it and mark the passenger as boarded."""
    payload = request.get_json(silent=True) or {}
    token = (payload.get("ticket_token") or "").strip()
    if not token:
        return jsonify({"error": "ticket_token_required"}), 400

    booking = Booking.query.filter_by(ticket_token=token).first()
    if not booking:
        return jsonify({"valid": False, "reason": "Ticket not found. Invalid QR code."}), 200

    if booking.status == "cancelled":
        return jsonify({"valid": False, "reason": "This booking has been cancelled."}), 200

    # Drivers may only scan tickets for their own assigned trip
    current_user = g.current_user or {}
    if current_user.get("role") == "driver":
        trip = db.session.get(Trip, booking.trip_id)
        if not trip or str(trip.assigned_to) != current_user.get("user_id"):
            return jsonify({"valid": False, "reason": "This ticket is not for one of your trips."}), 200

    if booking.boarded_at is not None:
        return jsonify({
            "valid": False,
            "reason": "This ticket has already been scanned.",
            "boarded_at": booking.boarded_at.isoformat(),
        }), 200

    # Mark as boarded
    booking.boarded_at = datetime.now()
    booking.status = "boarded"
    db.session.commit()

    return jsonify({
        "valid": True,
        "booking": booking.to_dict(),
        "passenger_name": booking.user.full_name if booking.user else "Unknown",
    }), 200


@booking_bp.delete("/bookings/<booking_id>")
@jwt_required()
@role_required("admin")
def delete_booking(booking_id: str):
    booking_uuid, error = parse_uuid(booking_id, "booking_id")
    if error:
        return error
    booking = db.session.get(Booking, booking_uuid)
    if not booking:
        return jsonify({"error": "booking_not_found"}), 404
    db.session.delete(booking)
    db.session.commit()
    return jsonify({"status": "deleted"}), 200
