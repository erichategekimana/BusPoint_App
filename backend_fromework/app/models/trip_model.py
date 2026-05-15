from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from datetime import datetime
from app.database import db


class Trip(db.Model):
    __tablename__ = 'trips'

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    bus_id = db.Column(UUID(as_uuid=True), db.ForeignKey('buses.id', ondelete='CASCADE'), nullable=False)
    route_id = db.Column(UUID(as_uuid=True), db.ForeignKey('routes.id', ondelete='CASCADE'), nullable=False)
    departure_time = db.Column(db.DateTime(timezone=True), nullable=False)
    arrival_time = db.Column(db.DateTime(timezone=True))
    status = db.Column(db.String(20), server_default='scheduled')
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    current_capacity = db.Column(db.Integer, nullable=False)
    current_lat = db.Column(db.Float, nullable=True)  # Updated by driver app
    current_lon = db.Column(db.Float, nullable=True)  # Updated by driver app
    current_speed = db.Column(db.Float, nullable=True)  # Updated by driver app
    driver_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    STATUS_SCHEDULED = 'scheduled'
    STATUS_ACTIVE = 'active'
    STATUS_COMPLETED = 'completed'
    STATUS_CANCELLED = 'cancelled'

    # Relationships
    bus = db.relationship('Bus', back_populates='trips')
    route = db.relationship('Route', back_populates='trips')
    bookings = db.relationship('Booking', back_populates='trip')
    locations = db.relationship('BusLocation', back_populates='trip', uselist=False)  # One-to-One for real-time tracking
    driver = db.relationship('User', foreign_keys=[driver_id], backref='driven_trips')


    def to_dict(self):
        return {
            "id": str(self.id),
            "bus_plate": self.bus.plate_number,
            "route_name": self.route.name,
            "departure_time": self.departure_time.isoformat() if self.departure_time else None,
            "arrival_time": self.arrival_time.isoformat() if self.arrival_time else None,
            "status": self.status,
            "available_seats": self.current_capacity,
            "capacity": self.bus.capacity,
            "bus_type": self.bus.bus_type,
            "driver_id": str(self.driver_id) if self.driver_id else None
        }
