from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from datetime import datetime
from app.database import db



class BusLocation(db.Model):
    __tablename__ = 'bus_locations'

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    bus_id = db.Column(UUID(as_uuid=True), db.ForeignKey('buses.id', ondelete='CASCADE'), nullable=False)
    trip_id = db.Column(UUID(as_uuid=True), db.ForeignKey('trips.id', ondelete='CASCADE'), nullable=False)
    latitude = db.Column(db.Numeric(10, 8), nullable=False)
    longitude = db.Column(db.Numeric(11, 8), nullable=False)
    speed = db.Column(db.Numeric(5, 2), server_default='0.0')
    heading = db.Column(db.Numeric(5, 2))
    last_updated  = db.Column(db.DateTime(timezone=True), server_default=func.now())

    # Relationship back to Bus
    bus = db.relationship('Bus', back_populates='location', uselist=False)
    trip = db.relationship('Trip', back_populates='locations', lazy=True)
