from __future__ import annotations

import secrets
from datetime import datetime, timezone
from uuid import UUID

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func

from .auth import create_access_token, hash_password, jwt_required, verify_password
from .database import db
from .models import Booking, Bus, BusLocation, Route, RouteStop, Stop, Trip, User
from .schemas import (
    BookingCreateRequest,
    BookingPublic,
    BusLocationPublic,
    BusLocationUpdateRequest,
    LoginRequest,
    RegisterRequest,
    RoutePublic,
    RouteStopPublic,
    RouteWithStops,
    StopPublic,
    TripPublic,
    UserPublic,
)
from .utils import validate_json


api_bp = Blueprint("api", __name__, url_prefix="/api")


def parse_uuid(raw_value: str, field_name: str):
    try:
        return UUID(raw_value), None
    except ValueError:
        return None, (jsonify({"error": f"invalid_{field_name}"}), 400)


def str_to_bool(raw: str | None, default: bool = False) -> bool:
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@api_bp.get("/health")
def health_check():
    return jsonify({"status": "ok"})


@api_bp.post("/auth/register")
@validate_json(RegisterRequest)
def register(**kwargs):
    validated: RegisterRequest = kwargs.pop("validated")
    
    existing_phone = User.query.filter_by(phone_number=validated.phone_number).first()
    if existing_phone:
        return jsonify({"error": "phone_number_already_exists"}), 409

    if validated.email:
        existing_email = User.query.filter_by(email=str(validated.email)).first()
        if existing_email:
            return jsonify({"error": "email_already_exists"}), 409

    user = User(
        full_name=validated.full_name.strip(),
        phone_number=validated.phone_number.strip(),
        email=str(validated.email) if validated.email else None,
        password_hash=hash_password(validated.password),
        role=validated.role,
    )
    db.session.add(user)
    db.session.commit()

    token = create_access_token({"user_id": str(user.id), "role": user.role})
    payload = {
        "user": UserPublic.model_validate(user).model_dump(mode="json"),
        "access_token": token,
    }
    return jsonify(payload), 201

@api_bp.post("/auth/login")
@validate_json(LoginRequest)
def login(**kwargs):
    validated: LoginRequest = kwargs.pop("validated")

    user = None
    if validated.phone_number:
        user = User.query.filter_by(phone_number=validated.phone_number).first()
    elif validated.email:
        user = User.query.filter_by(email=str(validated.email)).first()
    else:
        return jsonify({"error": "phone_number_or_email_required"}), 400

    if not user or not verify_password(user.password_hash, validated.password):
        return jsonify({"error": "invalid_credentials"}), 401

    token = create_access_token({"user_id": str(user.id), "role": user.role})
    payload = {
        "user": UserPublic.model_validate(user).model_dump(mode="json"),
        "access_token": token,
    }
    return jsonify(payload), 200


@api_bp.get("/routes")
def list_routes():
    include_inactive = str_to_bool(request.args.get("include_inactive"), default=False)
    include_stops = str_to_bool(request.args.get("include_stops"), default=False)

    query = Route.query
    if not include_inactive:
        query = query.filter_by(is_active=True)

    routes = query.order_by(Route.route_code.asc()).all()

    if not include_stops:
        data = [RoutePublic.model_validate(route).model_dump(mode="json") for route in routes]
        return jsonify(data), 200

    enriched = []
    for route in routes:
        route_stops = (
            RouteStop.query.filter_by(route_id=route.id)
            .join(Stop, Stop.id == RouteStop.stop_id)
            .order_by(RouteStop.stop_order.asc())
            .all()
        )

        stops_payload = [
            RouteStopPublic(
                id=rs.id,
                stop_order=rs.stop_order,
                estimated_minutes_from_start=rs.estimated_minutes_from_start,
                stop=StopPublic.model_validate(rs.stop),
            ).model_dump(mode="json")
            for rs in route_stops
        ]

        route_payload = RouteWithStops(
            id=route.id,
            route_code=route.route_code,
            name=route.name,
            is_active=route.is_active,
            stops=stops_payload,
        )
        enriched.append(route_payload.model_dump(mode="json"))

    return jsonify(enriched), 200


@api_bp.get("/routes/<route_id>/stops")
def list_route_stops(route_id: str):
    route_uuid, error = parse_uuid(route_id, "route_id")
    if error:
        return error

    route = db.session.get(Route, route_uuid)
    if not route:
        return jsonify({"error": "route_not_found"}), 404

    route_stops = (
        RouteStop.query.filter_by(route_id=route.id)
        .join(Stop, Stop.id == RouteStop.stop_id)
        .order_by(RouteStop.stop_order.asc())
        .all()
    )

    payload = [
        RouteStopPublic(
            id=rs.id,
            stop_order=rs.stop_order,
            estimated_minutes_from_start=rs.estimated_minutes_from_start,
            stop=StopPublic.model_validate(rs.stop),
        ).model_dump(mode="json")
        for rs in route_stops
    ]
    return jsonify(payload), 200


@api_bp.get("/stops")
def list_stops():
    include_inactive = str_to_bool(request.args.get("include_inactive"), default=False)
    query = Stop.query
    if not include_inactive:
        query = query.filter_by(is_active=True)

    stops = query.order_by(Stop.name.asc()).all()
    payload = [StopPublic.model_validate(stop).model_dump(mode="json") for stop in stops]
    return jsonify(payload), 200


@api_bp.get("/trips")
def list_trips():
    query = Trip.query

    route_id = request.args.get("route_id")
    if route_id:
        route_uuid, error = parse_uuid(route_id, "route_id")
        if error:
            return error
        query = query.filter_by(route_id=route_uuid)

    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)

    trips = query.order_by(Trip.departure_time.asc()).all()
    payload = [TripPublic.model_validate(trip).model_dump(mode="json") for trip in trips]
    return jsonify(payload), 200


@api_bp.get("/trips/<trip_id>")
def get_trip(trip_id: str):
    trip_uuid, error = parse_uuid(trip_id, "trip_id")
    if error:
        return error

    trip = db.session.get(Trip, trip_uuid)
    if not trip:
        return jsonify({"error": "trip_not_found"}), 404

    return jsonify(TripPublic.model_validate(trip).model_dump(mode="json")), 200


@api_bp.post("/bookings")
@jwt_required()
@validate_json(BookingCreateRequest)
def create_booking(**kwargs):
    validated: BookingCreateRequest = kwargs.pop("validated")

    current_user = g.current_user or {}
    user_id = current_user.get("user_id")
    if not user_id:
        return jsonify({"error": "invalid_token_payload"}), 401

    try:
        user_uuid = UUID(user_id)
    except ValueError:
        return jsonify({"error": "invalid_token_payload"}), 401

    user = db.session.get(User, user_uuid)
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    trip = db.session.get(Trip, validated.trip_id)
    if not trip:
        return jsonify({"error": "trip_not_found"}), 404

    route_stop_rows = RouteStop.query.filter_by(route_id=trip.route_id).all()
    stop_order_map = {row.stop_id: row.stop_order for row in route_stop_rows}

    pickup_order = stop_order_map.get(validated.pickup_stop_id)
    dropoff_order = stop_order_map.get(validated.dropoff_stop_id)
    if pickup_order is None or dropoff_order is None:
        return jsonify({"error": "pickup_or_dropoff_not_on_route"}), 400

    if pickup_order >= dropoff_order:
        return jsonify({"error": "pickup_must_be_before_dropoff"}), 400

    active_bookings_count = (
        db.session.query(func.count(Booking.id))
        .filter(
            Booking.trip_id == trip.id,
            Booking.status.in_(["pending", "confirmed"]),
        )
        .scalar()
        or 0
    )
    if active_bookings_count >= trip.current_capacity:
        return jsonify({"error": "trip_full"}), 409

    seat_number = validated.seat_number
    if seat_number:
        existing_seat = (
            Booking.query.filter_by(trip_id=trip.id, seat_number=seat_number)
            .filter(Booking.status.in_(["pending", "confirmed"]))
            .first()
        )
        if existing_seat:
            return jsonify({"error": "seat_already_taken"}), 409
    else:
        taken_seats = {
            b.seat_number
            for b in Booking.query.filter_by(trip_id=trip.id)
            .filter(Booking.status.in_(["pending", "confirmed"]))
            .all()
            if b.seat_number is not None
        }
        seat_number = next((s for s in range(1, trip.current_capacity + 1) if s not in taken_seats), None)

    ticket_token = None
    for _ in range(5):
        candidate = f"TK-{trip.route.route_code}-{secrets.token_hex(3).upper()}"
        if not Booking.query.filter_by(ticket_token=candidate).first():
            ticket_token = candidate
            break

    booking = Booking(
        user_id=user.id,
        trip_id=trip.id,
        seat_number=seat_number,
        status="confirmed",
        pickup_stop_id=validated.pickup_stop_id,
        dropoff_stop_id=validated.dropoff_stop_id,
        ticket_token=ticket_token,
    )

    db.session.add(booking)
    db.session.commit()

    return jsonify(BookingPublic.model_validate(booking).model_dump(mode="json")), 201


@api_bp.get("/bookings/me")
@jwt_required()
def list_my_bookings():
    current_user = g.current_user or {}
    user_id = current_user.get("user_id")
    if not user_id:
        return jsonify({"error": "invalid_token_payload"}), 401

    try:
        user_uuid = UUID(user_id)
    except ValueError:
        return jsonify({"error": "invalid_token_payload"}), 401

    bookings = Booking.query.filter_by(user_id=user_uuid).order_by(Booking.created_at.desc()).all()
    payload = [BookingPublic.model_validate(booking).model_dump(mode="json") for booking in bookings]
    return jsonify(payload), 200


@api_bp.get("/buses/<bus_id>/location")
def get_bus_location(bus_id: str):
    bus_uuid, error = parse_uuid(bus_id, "bus_id")
    if error:
        return error

    location = BusLocation.query.filter_by(bus_id=bus_uuid).first()
    if not location:
        return jsonify({"error": "bus_location_not_found"}), 404

    return jsonify(BusLocationPublic.model_validate(location).model_dump(mode="json")), 200


@api_bp.put("/buses/<bus_id>/location")
@jwt_required(roles={"driver", "admin"})
@validate_json(BusLocationUpdateRequest)
def upsert_bus_location(bus_id: str, **kwargs):
    validated: BusLocationUpdateRequest = kwargs.pop("validated")

    bus_uuid, error = parse_uuid(bus_id, "bus_id")
    if error:
        return error

    bus = db.session.get(Bus, bus_uuid)
    if not bus:
        return jsonify({"error": "bus_not_found"}), 404

    trip = db.session.get(Trip, validated.trip_id)
    if not trip:
        return jsonify({"error": "trip_not_found"}), 404

    if trip.bus_id != bus.id:
        return jsonify({"error": "trip_does_not_belong_to_bus"}), 400

    location = BusLocation.query.filter_by(bus_id=bus.id).first()
    if not location:
        location = BusLocation(
            bus_id=bus.id,
            trip_id=trip.id,
            latitude=validated.latitude,
            longitude=validated.longitude,
            speed=validated.speed,
            heading=validated.heading,
        )
        db.session.add(location)
    else:
        location.trip_id = trip.id
        location.latitude = validated.latitude
        location.longitude = validated.longitude
        location.speed = validated.speed
        location.heading = validated.heading
        location.last_updated = datetime.now(timezone.utc)

    db.session.commit()

    return jsonify(BusLocationPublic.model_validate(location).model_dump(mode="json")), 200
