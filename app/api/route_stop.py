from __future__ import annotations

from uuid import UUID

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from app.auth import jwt_required, role_required
from app.database import db
from app.models import Route, RouteStop, Stop
from app.schemas import RouteStopCreateRequest, RouteStopUpdateRequest


route_stop_bp = Blueprint("route_stop_api", __name__, url_prefix="/api")


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


@route_stop_bp.get("/route-stops")
def list_route_stops():
    route_id = request.args.get("route_id")
    stop_id = request.args.get("stop_id")

    query = RouteStop.query
    if route_id:
        route_uuid, error = parse_uuid(route_id, "route_id")
        if error:
            return error
        query = query.filter(RouteStop.route_id == route_uuid)
    if stop_id:
        stop_uuid, error = parse_uuid(stop_id, "stop_id")
        if error:
            return error
        query = query.filter(RouteStop.stop_id == stop_uuid)

    route_stops = query.order_by(RouteStop.stop_order.asc()).all()
    return jsonify([route_stop.to_dict() for route_stop in route_stops]), 200


@route_stop_bp.get("/route-stops/<route_stop_id>")
def get_route_stop(route_stop_id: str):
    route_stop_uuid, error = parse_uuid(route_stop_id, "route_stop_id")
    if error:
        return error
    route_stop = db.session.get(RouteStop, route_stop_uuid)
    if not route_stop:
        return jsonify({"error": "route_stop_not_found"}), 404
    return jsonify(route_stop.to_dict()), 200


@route_stop_bp.post("/route-stops")
@jwt_required()
@role_required("admin")
def create_route_stop():
    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(RouteStopCreateRequest, payload)
    if error:
        return error

    route = db.session.get(Route, validated.route_id)
    if not route:
        return jsonify({"error": "route_not_found"}), 404
    stop = db.session.get(Stop, validated.stop_id)
    if not stop:
        return jsonify({"error": "stop_not_found"}), 404

    existing = RouteStop.query.filter_by(route_id=validated.route_id, stop_id=validated.stop_id).first()
    if existing:
        return jsonify({"error": "route_stop_already_exists"}), 409

    existing_order = RouteStop.query.filter_by(route_id=validated.route_id, stop_order=validated.stop_order).first()
    if existing_order:
        return jsonify({"error": "stop_order_already_used"}), 409

    route_stop = RouteStop(
        route_id=validated.route_id,
        stop_id=validated.stop_id,
        stop_order=validated.stop_order,
        estimated_minutes_from_start=validated.estimated_minutes_from_start,
    )

    db.session.add(route_stop)
    db.session.commit()
    return jsonify(route_stop.to_dict()), 201


@route_stop_bp.patch("/route-stops/<route_stop_id>")
@jwt_required()
@role_required("admin")
def update_route_stop(route_stop_id: str):
    route_stop_uuid, error = parse_uuid(route_stop_id, "route_stop_id")
    if error:
        return error
    route_stop = db.session.get(RouteStop, route_stop_uuid)
    if not route_stop:
        return jsonify({"error": "route_stop_not_found"}), 404

    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(RouteStopUpdateRequest, payload)
    if error:
        return error

    next_route_id = validated.route_id or route_stop.route_id
    next_stop_id = validated.stop_id or route_stop.stop_id
    next_stop_order = validated.stop_order or route_stop.stop_order

    if validated.route_id and not db.session.get(Route, validated.route_id):
        return jsonify({"error": "route_not_found"}), 404
    if validated.stop_id and not db.session.get(Stop, validated.stop_id):
        return jsonify({"error": "stop_not_found"}), 404

    duplicate = RouteStop.query.filter(
        RouteStop.route_id == next_route_id,
        RouteStop.stop_id == next_stop_id,
        RouteStop.id != route_stop.id,
    ).first()
    if duplicate:
        return jsonify({"error": "route_stop_already_exists"}), 409

    duplicate_order = RouteStop.query.filter(
        RouteStop.route_id == next_route_id,
        RouteStop.stop_order == next_stop_order,
        RouteStop.id != route_stop.id,
    ).first()
    if duplicate_order:
        return jsonify({"error": "stop_order_already_used"}), 409

    route_stop.route_id = next_route_id
    route_stop.stop_id = next_stop_id
    route_stop.stop_order = next_stop_order
    if validated.estimated_minutes_from_start is not None:
        route_stop.estimated_minutes_from_start = validated.estimated_minutes_from_start

    db.session.commit()
    return jsonify(route_stop.to_dict()), 200


@route_stop_bp.delete("/route-stops/<route_stop_id>")
@jwt_required()
@role_required("admin")
def delete_route_stop(route_stop_id: str):
    route_stop_uuid, error = parse_uuid(route_stop_id, "route_stop_id")
    if error:
        return error
    route_stop = db.session.get(RouteStop, route_stop_uuid)
    if not route_stop:
        return jsonify({"error": "route_stop_not_found"}), 404
    db.session.delete(route_stop)
    db.session.commit()
    return jsonify({"status": "deleted"}), 200
