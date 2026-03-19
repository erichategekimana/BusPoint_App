from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from datetime import datetime
from app.database import db


class Bus(db.Model):
    __tablename__ = 'buses'
    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    plate_number = db.Column(db.String(15), unique=True, nullable=False)
    bus_type = db.Column(db.String(50))
    capacity = db.Column(db.Integer, nullable=False)
    is_active = db.Column(db.Boolean, server_default='True')
    managed_by = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    trips = db.relationship('Trip', back_populates='bus')
    location = db.relationship('BusLocation', back_populates='bus', uselist=False)
    manager = db.relationship('User', foreign_keys=[managed_by])


    def to_dict(self):
        return {
            "id": str(self.id),
            "plate_number": self.plate_number,
            "bus_type": self.bus_type,
            "capacity": self.capacity,
            "is_active": self.is_active,
            "managed_by": str(self.managed_by) if self.managed_by else None,
        }
