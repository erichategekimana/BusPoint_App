from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import db
from datetime import datetime

class Booking(db.Model):
    __tablename__ = 'bookings'

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id'), nullable=False)
    trip_id = db.Column(UUID(as_uuid=True), db.ForeignKey('trips.id', ondelete='CASCADE'), nullable=False)
    seat_number = db.Column(db.Integer)
    status = db.Column(db.String(20), server_default='pending')
    pickup_stop_id = db.Column(UUID(as_uuid=True), db.ForeignKey('stops.id'))
    dropoff_stop_id = db.Column(UUID(as_uuid=True), db.ForeignKey('stops.id'))
    ticket_token = db.Column(db.String(100), unique=True)
    boarded_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = db.relationship('User', back_populates='bookings')
    trip = db.relationship('Trip', back_populates='bookings')
    payment = db.relationship('Payment', back_populates='booking', uselist=False, cascade='all, delete-orphan', passive_deletes=True)
    pickup_stop = db.relationship('Stop', foreign_keys=[pickup_stop_id])
    dropoff_stop = db.relationship('Stop', foreign_keys=[dropoff_stop_id])


    def to_dict(self):
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "trip_id": str(self.trip_id),
            "departure_time": self.trip.departure_time,
            "status": self.status,
            "seat_number": self.seat_number,
            "pickup_stop": self.pickup_stop.name if self.pickup_stop else None,
            "dropoff_stop": self.dropoff_stop.name if self.dropoff_stop else None,
            "ticket_token": self.ticket_token,
            "boarded_at": self.boarded_at.isoformat() if self.boarded_at else None,
            "created_at": self.created_at.isoformat()
        }
