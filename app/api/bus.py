from __future__ import annotations

from uuid import UUID

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from app.auth import jwt_required, role_required
from app.database import db
from app.models import Bus
from app.schemas import BusCreateRequest, BusUpdateRequest


bus_bp = Blueprint("bus_api", __name__, url_prefix="/api")


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


def parse_bool(raw: str | None) -> bool | None:
    if raw is None:
        return None
    return raw.strip().lower() in {"1", "true", "yes"}


# ── READ endpoints — open to everyone ──────────────────────────────────────

@bus_bp.get("/buses")
def list_buses():
    is_active = parse_bool(request.args.get("is_active"))
    company = request.args.get("company")
    query = Bus.query
    if is_active is not None:
        query = query.filter(Bus.is_active == is_active)
    if company:
        query = query.filter(Bus.company == company)
    buses = query.order_by(Bus.plate_number.asc()).all()
    return jsonify([bus.to_dict() for bus in buses]), 200


@bus_bp.get("/buses/<bus_id>")
def get_bus(bus_id: str):
    bus_uuid, error = parse_uuid(bus_id, "bus_id")
    if error:
        return error
    bus = db.session.get(Bus, bus_uuid)
    if not bus:
        return jsonify({"error": "bus_not_found"}), 404
    return jsonify(bus.to_dict()), 200


@bus_bp.post("/buses")
@jwt_required()
@role_required("admin")
def create_bus():
    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(BusCreateRequest, payload)
    if error:
        return error

    if Bus.query.filter_by(plate_number=validated.plate_number).first():
        return jsonify({"error": "plate_number_already_exists"}), 409

    bus = Bus(
        plate_number=validated.plate_number.strip(),
        bus_type=validated.bus_type,
        capacity=validated.capacity,
    )
    if validated.is_active is not None:
        bus.is_active = validated.is_active
    if validated.company is not None:
        bus.company = validated.company.strip()

    db.session.add(bus)
    db.session.commit()
    return jsonify(bus.to_dict()), 201


@bus_bp.patch("/buses/<bus_id>")
@jwt_required()
@role_required("admin")
def update_bus(bus_id: str):
    bus_uuid, error = parse_uuid(bus_id, "bus_id")
    if error:
        return error
    bus = db.session.get(Bus, bus_uuid)
    if not bus:
        return jsonify({"error": "bus_not_found"}), 404

    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(BusUpdateRequest, payload)
    if error:
        return error

    if validated.plate_number and validated.plate_number != bus.plate_number:
        existing = Bus.query.filter(Bus.plate_number == validated.plate_number, Bus.id != bus.id).first()
        if existing:
            return jsonify({"error": "plate_number_already_exists"}), 409
        bus.plate_number = validated.plate_number.strip()

    if validated.company is not None:
        bus.company = validated.company.strip()
    if validated.bus_type is not None:
        bus.bus_type = validated.bus_type
    if validated.capacity is not None:
        bus.capacity = validated.capacity
    if validated.is_active is not None:
        bus.is_active = validated.is_active

    db.session.commit()
    return jsonify(bus.to_dict()), 200


@bus_bp.delete("/buses/<bus_id>")
@jwt_required()
@role_required("admin")
def delete_bus(bus_id: str):
    bus_uuid, error = parse_uuid(bus_id, "bus_id")
    if error:
        return error
    bus = db.session.get(Bus, bus_uuid)
    if not bus:
        return jsonify({"error": "bus_not_found"}), 404
    db.session.delete(bus)
    db.session.commit()
    return jsonify({"status": "deleted"}), 200
