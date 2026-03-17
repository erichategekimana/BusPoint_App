from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import db


class Route(db.Model):
    __tablename__ = 'routes'
    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    route_code = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    is_active = db.Column(db.Boolean, server_default='true')
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    trips = db.relationship('Trip', back_populates='route')

    # Relationship

    route_stops = db.relationship('RouteStop', back_populates='route')

    def to_dict(self):
        return {
            "id": str(self.id),
            "route_code": self.route_code,
            "name": self.name,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
