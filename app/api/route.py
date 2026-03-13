from __future__ import annotations

from uuid import UUID

from flask import Blueprint, jsonify, request
from pydantic import BaseModel, Field, ValidationError

from app.database import db
from app.models import Route


route_bp = Blueprint("route_api", __name__, url_prefix="/api")


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


class RouteCreateRequest(BaseModel):
    route_code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=2, max_length=100)
    is_active: bool | None = None


class RouteUpdateRequest(BaseModel):
    route_code: str | None = Field(default=None, min_length=1, max_length=20)
    name: str | None = Field(default=None, min_length=2, max_length=100)
    is_active: bool | None = None


def parse_bool(raw: str | None) -> bool | None:
    if raw is None:
        return None
    return raw.strip().lower() in {"1", "true", "yes"}


@route_bp.get("/routes")
def list_routes():
    is_active = parse_bool(request.args.get("is_active"))
    query = Route.query
    if is_active is not None:
        query = query.filter(Route.is_active == is_active)
    routes = query.order_by(Route.route_code.asc()).all()
    return jsonify([route.to_dict() for route in routes]), 200


@route_bp.get("/routes/<route_id>")
def get_route(route_id: str):
    route_uuid, error = parse_uuid(route_id, "route_id")
    if error:
        return error
    route = db.session.get(Route, route_uuid)
    if not route:
        return jsonify({"error": "route_not_found"}), 404
    return jsonify(route.to_dict()), 200


@route_bp.post("/routes")
def create_route():
    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(RouteCreateRequest, payload)
    if error:
        return error

    if Route.query.filter_by(route_code=validated.route_code).first():
        return jsonify({"error": "route_code_already_exists"}), 409

    route = Route(
        route_code=validated.route_code.strip(),
        name=validated.name.strip(),
    )
    if validated.is_active is not None:
        route.is_active = validated.is_active

    db.session.add(route)
    db.session.commit()
    return jsonify(route.to_dict()), 201


@route_bp.patch("/routes/<route_id>")
def update_route(route_id: str):
    route_uuid, error = parse_uuid(route_id, "route_id")
    if error:
        return error
    route = db.session.get(Route, route_uuid)
    if not route:
        return jsonify({"error": "route_not_found"}), 404

    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(RouteUpdateRequest, payload)
    if error:
        return error

    if validated.route_code and validated.route_code != route.route_code:
        existing = Route.query.filter(Route.route_code == validated.route_code, Route.id != route.id).first()
        if existing:
            return jsonify({"error": "route_code_already_exists"}), 409
        route.route_code = validated.route_code.strip()

    if validated.name is not None:
        route.name = validated.name.strip()
    if validated.is_active is not None:
        route.is_active = validated.is_active

    db.session.commit()
    return jsonify(route.to_dict()), 200


@route_bp.delete("/routes/<route_id>")
def delete_route(route_id: str):
    route_uuid, error = parse_uuid(route_id, "route_id")
    if error:
        return error
    route = db.session.get(Route, route_uuid)
    if not route:
        return jsonify({"error": "route_not_found"}), 404
    db.session.delete(route)
    db.session.commit()
    return jsonify({"status": "deleted"}), 200
