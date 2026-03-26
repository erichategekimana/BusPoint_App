from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from datetime import datetime
from app.database import db


class Trip(db.Model):
    __tablename__ = 'trips'

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    bus_id = db.Column(UUID(as_uuid=True), db.ForeignKey('buses.id', ondelete='CASCADE'), nullable=False)
    route_id = db.Column(UUID(as_uuid=True), db.ForeignKey('routes.id', ondelete='CASCADE'), nullable=False)
    assigned_to = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    departure_time = db.Column(db.DateTime(timezone=True), nullable=False)
    arrival_time = db.Column(db.DateTime(timezone=True))
    status = db.Column(db.String(20), server_default='scheduled')
    current_capacity = db.Column(db.Integer, nullable=False)

    # Relationships
    bus = db.relationship('Bus', back_populates='trips')
    route = db.relationship('Route', back_populates='trips')
    assignee = db.relationship('User', foreign_keys=[assigned_to])
    bookings = db.relationship('Booking', back_populates='trip', cascade='all, delete-orphan', passive_deletes=True)
    locations = db.relationship('BusLocation', back_populates='trip', cascade='all, delete-orphan', passive_deletes=True, lazy=True)
    pings = db.relationship('GpsPing', back_populates='trip', cascade='all, delete-orphan', passive_deletes=True, order_by='GpsPing.timestamp', lazy=True)

    @property
    def latest_ping(self):
        """Return the most recent GPS ping for this trip (for live map display)."""
        from app.models.gps_ping_model import GpsPing
        return (
            GpsPing.query
            .filter_by(trip_id=self.id)
            .order_by(GpsPing.timestamp.desc())
            .first()
        )

    def to_dict(self):
        return {
            "id": str(self.id),
            "bus_id": str(self.bus_id),
            "bus_plate": self.bus.plate_number,
            "route_id": str(self.route_id),
            "route_name": self.route.name,
            "assigned_to": str(self.assigned_to) if self.assigned_to else None,
            "departure_time": self.departure_time.isoformat() if self.departure_time else None,
            "arrival_time": self.arrival_time.isoformat() if self.arrival_time else None,
            "status": self.status,
            "current_capacity": self.current_capacity,
            "available_seats": self.current_capacity
        }
