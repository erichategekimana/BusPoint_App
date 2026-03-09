from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID

from .database import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    full_name = db.Column(db.String(100), nullable=False)
    phone_number = db.Column(db.String(15), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, server_default=text("'passenger'"))
    created_at = db.Column(db.DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at = db.Column(db.DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), onupdate=db.func.now())


class Bus(db.Model):
    __tablename__ = "buses"

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    plate_number = db.Column(db.String(15), unique=True, nullable=False)
    bus_type = db.Column(db.String(50))
    capacity = db.Column(db.Integer, nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, server_default=text("true"))
    created_at = db.Column(db.DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at = db.Column(db.DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), onupdate=db.func.now())


class Route(db.Model):
    __tablename__ = "routes"

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    route_code = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, server_default=text("true"))
    created_at = db.Column(db.DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at = db.Column(db.DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), onupdate=db.func.now())


class Stop(db.Model):
    __tablename__ = "stops"

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = db.Column(db.String(100), nullable=False)
    latitude = db.Column(db.Numeric(10, 8), nullable=False)
    longitude = db.Column(db.Numeric(11, 8), nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, server_default=text("true"))
    created_at = db.Column(db.DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    updated_at = db.Column(db.DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), onupdate=db.func.now())


class RouteStop(db.Model):
    __tablename__ = "route_stops"

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    route_id = db.Column(UUID(as_uuid=True), db.ForeignKey("routes.id", ondelete="CASCADE"), nullable=False)
    stop_id = db.Column(UUID(as_uuid=True), db.ForeignKey("stops.id", ondelete="CASCADE"), nullable=False)
    stop_order = db.Column(db.Integer, nullable=False)
    estimated_minutes_from_start = db.Column(db.Integer, nullable=False, server_default=text("0"))

    route = db.relationship("Route", backref=db.backref("route_stops", cascade="all, delete-orphan"))
    stop = db.relationship("Stop")


class Trip(db.Model):
    __tablename__ = "trips"

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    bus_id = db.Column(UUID(as_uuid=True), db.ForeignKey("buses.id", ondelete="CASCADE"), nullable=False)
    route_id = db.Column(UUID(as_uuid=True), db.ForeignKey("routes.id", ondelete="CASCADE"), nullable=False)
    departure_time = db.Column(db.DateTime(timezone=True), nullable=False)
    arrival_time = db.Column(db.DateTime(timezone=True))
    status = db.Column(db.String(20), nullable=False, server_default=text("'scheduled'"))
    current_capacity = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))

    bus = db.relationship("Bus")
    route = db.relationship("Route")


class Booking(db.Model):
    __tablename__ = "bookings"

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    trip_id = db.Column(UUID(as_uuid=True), db.ForeignKey("trips.id"), nullable=False)
    seat_number = db.Column(db.Integer)
    status = db.Column(db.String(20), nullable=False, server_default=text("'pending'"))
    pickup_stop_id = db.Column(UUID(as_uuid=True), db.ForeignKey("stops.id"))
    dropoff_stop_id = db.Column(UUID(as_uuid=True), db.ForeignKey("stops.id"))
    created_at = db.Column(db.DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))
    ticket_token = db.Column(db.String(100), unique=True)
    boarded_at = db.Column(db.DateTime(timezone=True))

    user = db.relationship("User")
    trip = db.relationship("Trip")
    pickup_stop = db.relationship("Stop", foreign_keys=[pickup_stop_id])
    dropoff_stop = db.relationship("Stop", foreign_keys=[dropoff_stop_id])


class Payment(db.Model):
    __tablename__ = "payments"

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    booking_id = db.Column(UUID(as_uuid=True), db.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    currency = db.Column(db.String(3), nullable=False, server_default=text("'RWF'"))
    payment_method = db.Column(db.String(20))
    transaction_ref = db.Column(db.String(100), unique=True)
    status = db.Column(db.String(20), nullable=False, server_default=text("'pending'"))
    paid_at = db.Column(db.DateTime(timezone=True))

    booking = db.relationship("Booking", backref=db.backref("payments", cascade="all, delete-orphan"))


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(50))
    is_ready = db.Column(db.Boolean, nullable=False, server_default=text("false"))
    created_at = db.Column(db.DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"))


class BusLocation(db.Model):
    __tablename__ = "bus_locations"

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    bus_id = db.Column(UUID(as_uuid=True), db.ForeignKey("buses.id", ondelete="CASCADE"), nullable=False, unique=True)
    trip_id = db.Column(UUID(as_uuid=True), db.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    latitude = db.Column(db.Numeric(10, 8), nullable=False)
    longitude = db.Column(db.Numeric(11, 8), nullable=False)
    speed = db.Column(db.Float)
    heading = db.Column(db.Float)
    last_updated = db.Column(db.DateTime(timezone=True), nullable=False, server_default=text("CURRENT_TIMESTAMP"))

    bus = db.relationship("Bus")
    trip = db.relationship("Trip")
