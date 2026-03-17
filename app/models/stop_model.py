from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from datetime import datetime
from app.database import db

class Stop(db.Model):
    __tablename__ = 'stops'

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = db.Column(db.String(100), nullable=False)
    latitude = db.Column(db.Numeric(10, 8), nullable=False)
    longitude = db.Column(db.Numeric(11, 8), nullable=False)
    is_active = db.Column(db.Boolean, server_default='true')    
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # PostGIS Geography column
    geom = db.Column(Geometry(geometry_type='POINT', srid=4326, spatial_index=True))

    # Relationships
    route_stops = db.relationship('RouteStop', back_populates='stop')

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "latitude": float(self.latitude),
            "longitude": float(self.longitude),
            "is_active": self.is_active
        }
