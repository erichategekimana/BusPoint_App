from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from flask import Blueprint, jsonify, request
from pydantic import BaseModel, Field, ValidationError

from app.auth import jwt_required, role_required
from app.database import db
from app.models import Booking, Payment

log = logging.getLogger(__name__)


payment_bp = Blueprint("payment_api", __name__, url_prefix="/api")


class PaymentCreateRequest(BaseModel):
    booking_id: UUID
    amount: float = Field(gt=0)
    currency: str | None = Field(default=None, max_length=3)
    payment_method: str | None = Field(default=None, max_length=20)
    transaction_ref: str | None = Field(default=None, max_length=100)
    phone_number: str | None = Field(default=None, max_length=20)


class PaymentUpdateRequest(BaseModel):
    amount: float | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, max_length=3)
    payment_method: str | None = Field(default=None, max_length=20)
    transaction_ref: str | None = Field(default=None, max_length=100)
    status: str | None = None
    paid_at: str | None = None


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


# ── READ endpoints — admin only ─────────────────────────────────────────────

@payment_bp.get("/payments")
@jwt_required()
@role_required("admin")
def list_payments():
    booking_id = request.args.get("booking_id")
    status = request.args.get("status")

    query = Payment.query
    if booking_id:
        booking_uuid, error = parse_uuid(booking_id, "booking_id")
        if error:
            return error
        query = query.filter(Payment.booking_id == booking_uuid)
    if status:
        query = query.filter(Payment.status == status)

    payments = query.order_by(Payment.id.asc()).all()
    return jsonify([payment.to_dict() for payment in payments]), 200


@payment_bp.get("/payments/<payment_id>")
@jwt_required()
@role_required("admin")
def get_payment(payment_id: str):
    payment_uuid, error = parse_uuid(payment_id, "payment_id")
    if error:
        return error
    payment = db.session.get(Payment, payment_uuid)
    if not payment:
        return jsonify({"error": "payment_not_found"}), 404
    return jsonify(payment.to_dict()), 200


# ── WRITE endpoints — admin only ────────────────────────────────────────────

@payment_bp.post("/payments")
@jwt_required()
def create_payment():
    current_user = __import__('flask').g.current_user or {}
    role = current_user.get("role")

    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(PaymentCreateRequest, payload)
    if error:
        return error

    booking = db.session.get(Booking, validated.booking_id)
    if not booking:
        return jsonify({"error": "booking_not_found"}), 404

    # Passengers may only pay for their own bookings
    if role != "admin" and str(booking.user_id) != current_user.get("user_id"):
        return jsonify({"error": "forbidden"}), 403

    if validated.transaction_ref and Payment.query.filter_by(transaction_ref=validated.transaction_ref).first():
        return jsonify({"error": "transaction_ref_already_exists"}), 409

    # ── MTN MoMo: initiate Request-to-Pay ────────────────────────────────
    momo_ref = None
    if validated.payment_method == "mtn":
        phone = validated.phone_number or current_user.get("phone_number")
        if not phone:
            return jsonify({"error": "phone_number_required"}), 400
        try:
            from app.momo import request_to_pay
            momo_ref = request_to_pay(
                amount=validated.amount,
                currency=validated.currency,
                phone_number=phone,
                payer_message=f"BusPoint booking {str(validated.booking_id)[:8]}",
            )
        except Exception as exc:
            log.exception("MoMo request-to-pay failed")
            return jsonify({"error": "momo_request_failed", "message": str(exc)}), 502

    payment = Payment(
        booking_id=validated.booking_id,
        amount=validated.amount,
    )
    if validated.currency is not None:
        payment.currency = validated.currency
    if validated.payment_method is not None:
        payment.payment_method = validated.payment_method
    # Use MoMo reference if available, otherwise use client-provided ref
    payment.transaction_ref = momo_ref or validated.transaction_ref

    db.session.add(payment)
    db.session.commit()
    return jsonify(payment.to_dict()), 201


# ── MoMo payment status check ─────────────────────────────────────────────

@payment_bp.get("/payments/<payment_id>/status")
@jwt_required()
def check_payment_status(payment_id: str):
    """Poll MoMo for the current status of a pending payment."""
    current_user = __import__('flask').g.current_user or {}
    role = current_user.get("role")

    payment_uuid, error = parse_uuid(payment_id, "payment_id")
    if error:
        return error

    payment = db.session.get(Payment, payment_uuid)
    if not payment:
        return jsonify({"error": "payment_not_found"}), 404

    # Passengers may only check their own payments
    booking = db.session.get(Booking, payment.booking_id)
    if role != "admin" and booking and str(booking.user_id) != current_user.get("user_id"):
        return jsonify({"error": "forbidden"}), 403

    # If already finalised, just return current state
    if payment.status in ("completed", "failed"):
        return jsonify(payment.to_dict()), 200

    # Only query MoMo if we have a transaction_ref (i.e. a MoMo reference id)
    if payment.payment_method == "mtn" and payment.transaction_ref:
        try:
            from app.momo import get_payment_status
            momo = get_payment_status(payment.transaction_ref)
            momo_status = momo.get("status", "PENDING")

            if momo_status == "SUCCESSFUL":
                payment.status = "completed"
                payment.paid_at = datetime.now(timezone.utc)
                booking.status = "confirmed"
            elif momo_status == "FAILED":
                payment.status = "failed"

            db.session.commit()
        except Exception as exc:
            log.exception("MoMo status check failed")
            return jsonify({"error": "momo_status_check_failed", "message": str(exc)}), 502

    return jsonify(payment.to_dict()), 200


@payment_bp.patch("/payments/<payment_id>")
@jwt_required()
@role_required("admin")
def update_payment(payment_id: str):
    payment_uuid, error = parse_uuid(payment_id, "payment_id")
    if error:
        return error
    payment = db.session.get(Payment, payment_uuid)
    if not payment:
        return jsonify({"error": "payment_not_found"}), 404

    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(PaymentUpdateRequest, payload)
    if error:
        return error

    if validated.transaction_ref and validated.transaction_ref != payment.transaction_ref:
        existing = Payment.query.filter(
            Payment.transaction_ref == validated.transaction_ref,
            Payment.id != payment.id,
        ).first()
        if existing:
            return jsonify({"error": "transaction_ref_already_exists"}), 409
        payment.transaction_ref = validated.transaction_ref

    if validated.amount is not None:
        payment.amount = validated.amount
    if validated.currency is not None:
        payment.currency = validated.currency
    if validated.payment_method is not None:
        payment.payment_method = validated.payment_method
    if validated.status is not None:
        payment.status = validated.status
    if validated.paid_at is not None:
        payment.paid_at = datetime.fromisoformat(validated.paid_at)

    db.session.commit()
    return jsonify(payment.to_dict()), 200


@payment_bp.delete("/payments/<payment_id>")
@jwt_required()
@role_required("admin")
def delete_payment(payment_id: str):
    payment_uuid, error = parse_uuid(payment_id, "payment_id")
    if error:
        return error
    payment = db.session.get(Payment, payment_uuid)
    if not payment:
        return jsonify({"error": "payment_not_found"}), 404
    db.session.delete(payment)
    db.session.commit()
    return jsonify({"status": "deleted"}), 200
