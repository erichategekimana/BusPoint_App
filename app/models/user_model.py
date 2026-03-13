from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.database import db

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    full_name = db.Column(db.String(100), nullable=False)
    phone_number = db.Column(db.String(15), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), server_default='passenger')
    
    # func.now() translates directly to CURRENT_TIMESTAMP in PostgreSQL
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # ORM Relationships
    bookings = db.relationship('Booking', back_populates='user', lazy=True)
    notifications = db.relationship('Notification', back_populates='user', lazy=True)

    def __repr__(self):
        return f"<User {self.full_name} - {self.role}>"

    # A helpful utility method to safely return user data to the frontend
    def to_dict(self):
        return {
            "id": str(self.id),
            "full_name": self.full_name,
            "phone_number": self.phone_number,
            "email": self.email,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
