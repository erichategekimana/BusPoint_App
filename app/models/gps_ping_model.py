from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import db


class GpsPing(db.Model):
    __tablename__ = 'gps_pings'

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    trip_id = db.Column(UUID(as_uuid=True), db.ForeignKey('trips.id', ondelete='CASCADE'), nullable=False)
    latitude = db.Column(db.Numeric(10, 8), nullable=False)
    longitude = db.Column(db.Numeric(11, 8), nullable=False)
    timestamp = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())
    speed_kmh = db.Column(db.Numeric(6, 2))
    heading = db.Column(db.Numeric(5, 2))
    accuracy_m = db.Column(db.Numeric(7, 2))
    nearest_stop_id = db.Column(UUID(as_uuid=True), db.ForeignKey('stops.id', ondelete='SET NULL'), nullable=True)

    __table_args__ = (
        db.Index('ix_gps_pings_trip_timestamp', 'trip_id', 'timestamp'),
        db.Index('ix_gps_pings_lat_lng', 'latitude', 'longitude'),
    )

    # Relationships
    trip = db.relationship('Trip', back_populates='pings')
    nearest_stop = db.relationship('Stop', foreign_keys=[nearest_stop_id])

    def to_dict(self):
        return {
            "id": str(self.id),
            "trip_id": str(self.trip_id),
            "latitude": float(self.latitude),
            "longitude": float(self.longitude),
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "speed_kmh": float(self.speed_kmh) if self.speed_kmh is not None else None,
            "heading": float(self.heading) if self.heading is not None else None,
            "accuracy_m": float(self.accuracy_m) if self.accuracy_m is not None else None,
            "nearest_stop_id": str(self.nearest_stop_id) if self.nearest_stop_id else None,
            "nearest_stop_name": self.nearest_stop.name if self.nearest_stop else None,
        }
