from __future__ import annotations

from uuid import UUID

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from app.database import db
from app.models import Stop
from app.schemas import StopCreateRequest, StopUpdateRequest


stop_bp = Blueprint("stop_api", __name__, url_prefix="/api")


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


@stop_bp.get("/stops")
def list_stops():
    is_active = parse_bool(request.args.get("is_active"))
    query = Stop.query
    if is_active is not None:
        query = query.filter(Stop.is_active == is_active)
    stops = query.order_by(Stop.name.asc()).all()
    return jsonify([stop.to_dict() for stop in stops]), 200


@stop_bp.get("/stops/<stop_id>")
def get_stop(stop_id: str):
    stop_uuid, error = parse_uuid(stop_id, "stop_id")
    if error:
        return error
    stop = db.session.get(Stop, stop_uuid)
    if not stop:
        return jsonify({"error": "stop_not_found"}), 404
    return jsonify(stop.to_dict()), 200


@stop_bp.post("/stops")
def create_stop():
    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(StopCreateRequest, payload)
    if error:
        return error

    stop = Stop(
        name=validated.name.strip(),
        latitude=validated.latitude,
        longitude=validated.longitude,
    )
    if validated.is_active is not None:
        stop.is_active = validated.is_active

    db.session.add(stop)
    db.session.commit()
    return jsonify(stop.to_dict()), 201


@stop_bp.patch("/stops/<stop_id>")
def update_stop(stop_id: str):
    stop_uuid, error = parse_uuid(stop_id, "stop_id")
    if error:
        return error
    stop = db.session.get(Stop, stop_uuid)
    if not stop:
        return jsonify({"error": "stop_not_found"}), 404

    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(StopUpdateRequest, payload)
    if error:
        return error

    if validated.name is not None:
        stop.name = validated.name.strip()
    if validated.latitude is not None:
        stop.latitude = validated.latitude
    if validated.longitude is not None:
        stop.longitude = validated.longitude
    if validated.is_active is not None:
        stop.is_active = validated.is_active

    db.session.commit()
    return jsonify(stop.to_dict()), 200


@stop_bp.delete("/stops/<stop_id>")
def delete_stop(stop_id: str):
    stop_uuid, error = parse_uuid(stop_id, "stop_id")
    if error:
        return error
    stop = db.session.get(Stop, stop_uuid)
    if not stop:
        return jsonify({"error": "stop_not_found"}), 404
    db.session.delete(stop)
    db.session.commit()
    return jsonify({"status": "deleted"}), 200
