from __future__ import annotations

from uuid import UUID

from flask import Blueprint, jsonify, request
from pydantic import BaseModel, EmailStr, Field, ValidationError

from app.auth import hash_password
from app.database import db
from app.models import Bus, Route, RouteStop, Stop, User


tables_bp = Blueprint("tables_api", __name__, url_prefix="/api/tables")


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


def user_to_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "full_name": user.full_name,
        "phone_number": user.phone_number,
        "email": user.email,
        "role": user.role,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def bus_to_dict(bus: Bus) -> dict:
    return {
        "id": str(bus.id),
        "plate_number": bus.plate_number,
        "bus_type": bus.bus_type,
        "capacity": bus.capacity,
        "is_active": bus.is_active,
    }


def route_to_dict(route: Route) -> dict:
    return {
        "id": str(route.id),
        "route_code": route.route_code,
        "name": route.name,
        "is_active": route.is_active,
        "created_at": route.created_at.isoformat() if route.created_at else None,
        "updated_at": route.updated_at.isoformat() if route.updated_at else None,
    }


def stop_to_dict(stop: Stop) -> dict:
    return {
        "id": str(stop.id),
        "name": stop.name,
        "latitude": float(stop.latitude),
        "longitude": float(stop.longitude),
        "is_active": stop.is_active,
        "created_at": stop.created_at.isoformat() if stop.created_at else None,
        "updated_at": stop.updated_at.isoformat() if stop.updated_at else None,
    }


def route_stop_to_dict(route_stop: RouteStop) -> dict:
    return {
        "id": str(route_stop.id),
        "route_id": str(route_stop.route_id),
        "stop_id": str(route_stop.stop_id),
        "stop_order": route_stop.stop_order,
        "estimated_minutes_from_start": route_stop.estimated_minutes_from_start,
    }


class UserCreateRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    phone_number: str = Field(min_length=7, max_length=15)
    email: EmailStr | None = None
    password: str = Field(min_length=6, max_length=128)
    role: str = Field(default="passenger")


class UserUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=100)
    phone_number: str | None = Field(default=None, min_length=7, max_length=15)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)
    role: str | None = None


class BusCreateRequest(BaseModel):
    plate_number: str = Field(min_length=3, max_length=15)
    bus_type: str | None = Field(default=None, max_length=50)
    capacity: int = Field(ge=1)
    is_active: bool | None = None


class BusUpdateRequest(BaseModel):
    plate_number: str | None = Field(default=None, min_length=3, max_length=15)
    bus_type: str | None = Field(default=None, max_length=50)
    capacity: int | None = Field(default=None, ge=1)
    is_active: bool | None = None


class RouteCreateRequest(BaseModel):
    route_code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=2, max_length=100)
    is_active: bool | None = None


class RouteUpdateRequest(BaseModel):
    route_code: str | None = Field(default=None, min_length=1, max_length=20)
    name: str | None = Field(default=None, min_length=2, max_length=100)
    is_active: bool | None = None


class StopCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    is_active: bool | None = None


class StopUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    is_active: bool | None = None


class RouteStopCreateRequest(BaseModel):
    route_id: UUID
    stop_id: UUID
    stop_order: int = Field(ge=1)
    estimated_minutes_from_start: int | None = Field(default=None, ge=0)


class RouteStopUpdateRequest(BaseModel):
    route_id: UUID | None = None
    stop_id: UUID | None = None
    stop_order: int | None = Field(default=None, ge=1)
    estimated_minutes_from_start: int | None = Field(default=None, ge=0)


@tables_bp.get("/users")
def list_users():
    role = request.args.get("role")
    query = User.query
    if role:
        query = query.filter(User.role == role)
    users = query.order_by(User.created_at.desc()).all()
    return jsonify([user_to_dict(user) for user in users]), 200


@tables_bp.get("/users/<user_id>")
def get_user(user_id: str):
    user_uuid, error = parse_uuid(user_id, "user_id")
    if error:
        return error
    user = db.session.get(User, user_uuid)
    if not user:
        return jsonify({"error": "user_not_found"}), 404
    return jsonify(user_to_dict(user)), 200


@tables_bp.post("/users")
def create_user():
    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(UserCreateRequest, payload)
    if error:
        return error

    if User.query.filter_by(phone_number=validated.phone_number).first():
        return jsonify({"error": "phone_number_already_exists"}), 409
    if validated.email and User.query.filter_by(email=str(validated.email)).first():
        return jsonify({"error": "email_already_exists"}), 409

    user = User(
        full_name=validated.full_name.strip(),
        phone_number=validated.phone_number.strip(),
        email=str(validated.email) if validated.email else None,
        password_hash=hash_password(validated.password),
        role=validated.role or "passenger",
    )
    db.session.add(user)
    db.session.commit()
    return jsonify(user_to_dict(user)), 201


@tables_bp.patch("/users/<user_id>")
def update_user(user_id: str):
    user_uuid, error = parse_uuid(user_id, "user_id")
    if error:
        return error
    user = db.session.get(User, user_uuid)
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(UserUpdateRequest, payload)
    if error:
        return error

    if validated.phone_number and validated.phone_number != user.phone_number:
        existing = User.query.filter(User.phone_number == validated.phone_number, User.id != user.id).first()
        if existing:
            return jsonify({"error": "phone_number_already_exists"}), 409

    if validated.email and validated.email != user.email:
        existing = User.query.filter(User.email == str(validated.email), User.id != user.id).first()
        if existing:
            return jsonify({"error": "email_already_exists"}), 409

    if validated.full_name is not None:
        user.full_name = validated.full_name.strip()
    if validated.phone_number is not None:
        user.phone_number = validated.phone_number.strip()
    if validated.email is not None:
        user.email = str(validated.email)
    if validated.password is not None:
        user.password_hash = hash_password(validated.password)
    if validated.role is not None:
        user.role = validated.role

    db.session.commit()
    return jsonify(user_to_dict(user)), 200


@tables_bp.delete("/users/<user_id>")
def delete_user(user_id: str):
    user_uuid, error = parse_uuid(user_id, "user_id")
    if error:
        return error
    user = db.session.get(User, user_uuid)
    if not user:
        return jsonify({"error": "user_not_found"}), 404
    db.session.delete(user)
    db.session.commit()
    return jsonify({"status": "deleted"}), 200


@tables_bp.get("/buses")
def list_buses():
    is_active = request.args.get("is_active")
    query = Bus.query
    if is_active is not None:
        query = query.filter(Bus.is_active == (is_active.lower() in {"1", "true", "yes"}))
    buses = query.order_by(Bus.plate_number.asc()).all()
    return jsonify([bus_to_dict(bus) for bus in buses]), 200


@tables_bp.get("/buses/<bus_id>")
def get_bus(bus_id: str):
    bus_uuid, error = parse_uuid(bus_id, "bus_id")
    if error:
        return error
    bus = db.session.get(Bus, bus_uuid)
    if not bus:
        return jsonify({"error": "bus_not_found"}), 404
    return jsonify(bus_to_dict(bus)), 200


@tables_bp.post("/buses")
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

    db.session.add(bus)
    db.session.commit()
    return jsonify(bus_to_dict(bus)), 201


@tables_bp.patch("/buses/<bus_id>")
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

    if validated.bus_type is not None:
        bus.bus_type = validated.bus_type
    if validated.capacity is not None:
        bus.capacity = validated.capacity
    if validated.is_active is not None:
        bus.is_active = validated.is_active

    db.session.commit()
    return jsonify(bus_to_dict(bus)), 200


@tables_bp.delete("/buses/<bus_id>")
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


@tables_bp.get("/routes")
def list_routes():
    is_active = request.args.get("is_active")
    query = Route.query
    if is_active is not None:
        query = query.filter(Route.is_active == (is_active.lower() in {"1", "true", "yes"}))
    routes = query.order_by(Route.route_code.asc()).all()
    return jsonify([route_to_dict(route) for route in routes]), 200


@tables_bp.get("/routes/<route_id>")
def get_route(route_id: str):
    route_uuid, error = parse_uuid(route_id, "route_id")
    if error:
        return error
    route = db.session.get(Route, route_uuid)
    if not route:
        return jsonify({"error": "route_not_found"}), 404
    return jsonify(route_to_dict(route)), 200


@tables_bp.post("/routes")
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
    return jsonify(route_to_dict(route)), 201


@tables_bp.patch("/routes/<route_id>")
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
    return jsonify(route_to_dict(route)), 200


@tables_bp.delete("/routes/<route_id>")
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


@tables_bp.get("/stops")
def list_stops():
    is_active = request.args.get("is_active")
    query = Stop.query
    if is_active is not None:
        query = query.filter(Stop.is_active == (is_active.lower() in {"1", "true", "yes"}))
    stops = query.order_by(Stop.name.asc()).all()
    return jsonify([stop_to_dict(stop) for stop in stops]), 200


@tables_bp.get("/stops/<stop_id>")
def get_stop(stop_id: str):
    stop_uuid, error = parse_uuid(stop_id, "stop_id")
    if error:
        return error
    stop = db.session.get(Stop, stop_uuid)
    if not stop:
        return jsonify({"error": "stop_not_found"}), 404
    return jsonify(stop_to_dict(stop)), 200


@tables_bp.post("/stops")
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
    return jsonify(stop_to_dict(stop)), 201


@tables_bp.patch("/stops/<stop_id>")
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
    return jsonify(stop_to_dict(stop)), 200


@tables_bp.delete("/stops/<stop_id>")
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


@tables_bp.get("/route-stops")
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
    return jsonify([route_stop_to_dict(route_stop) for route_stop in route_stops]), 200


@tables_bp.get("/route-stops/<route_stop_id>")
def get_route_stop(route_stop_id: str):
    route_stop_uuid, error = parse_uuid(route_stop_id, "route_stop_id")
    if error:
        return error
    route_stop = db.session.get(RouteStop, route_stop_uuid)
    if not route_stop:
        return jsonify({"error": "route_stop_not_found"}), 404
    return jsonify(route_stop_to_dict(route_stop)), 200


@tables_bp.post("/route-stops")
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
    return jsonify(route_stop_to_dict(route_stop)), 201


@tables_bp.patch("/route-stops/<route_stop_id>")
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

    if validated.route_id:
        if not db.session.get(Route, validated.route_id):
            return jsonify({"error": "route_not_found"}), 404
    if validated.stop_id:
        if not db.session.get(Stop, validated.stop_id):
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
    return jsonify(route_stop_to_dict(route_stop)), 200


@tables_bp.delete("/route-stops/<route_stop_id>")
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
