from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from datetime import datetime
from app.database import db


class Route(db.Model):
    __tablename__ = 'routes'
    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    route_code = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    trips = db.relationship('Trip', back_populates='route')

    # Relationship

    route_stops = db.relationship('RouteStop', back_populates='route')
