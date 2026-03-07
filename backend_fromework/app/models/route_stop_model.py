from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from datetime import datetime
from app.database import db


class RouteStop(db.Model):
    __tablename__ = 'route_stops'

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    route_id = db.Column(UUID(as_uuid=True), db.ForeignKey('routes.id', ondelete='CASCADE'), nullable=False)
    stop_id = db.Column(UUID(as_uuid=True), db.ForeignKey('stops.id', ondelete='CASCADE'), nullable=False)
    stop_order = db.Column(db.Integer, nullable=False)
    estimated_minutes_from_start = db.Column(db.Integer)

    # Relationships
    route = db.relationship('Route', back_populates='route_stops')
    stop = db.relationship('Stop', back_populates='route_stops')
