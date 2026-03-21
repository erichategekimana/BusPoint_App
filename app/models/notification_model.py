from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from datetime import datetime
from app.database import db

class Notification(db.Model):
    __tablename__ = 'notifications'

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(50))
    is_ready = db.Column(db.Boolean, server_default='false')
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    # Relationship back to User
    user = db.relationship('User', back_populates='notifications')

    def to_dict(self):
        return {
            "id": str(self.id),
            "message": self.message,
            "is_ready": self.is_ready,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
