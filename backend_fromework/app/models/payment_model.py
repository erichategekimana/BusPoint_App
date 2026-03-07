from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from datetime import datetime
from app.database import db


class Payment(db.Model):
    __tablename__ = 'payments'

    id = db.Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    booking_id = db.Column(UUID(as_uuid=True), db.ForeignKey('bookings.id', ondelete='CASCADE'), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    currency = db.Column(db.String(3), server_default='RWF')
    payment_method = db.Column(db.String(20))
    transaction_ref = db.Column(db.String(100), unique=True)
    status = db.Column(db.String(20), server_default='pending')
    paid_at = db.Column(db.DateTime(timezone=True))

    # Relationship back to Booking
    booking = db.relationship('Booking', back_populates='payment')


    def to_dict(self):
        return {
            "id": str(self.id),
            "booking_id": str(self.booking_id),
            "amount": float(self.amount), # Numeric/Decimal must be float or string
            "currency": self.currency,
            "payment_method": self.payment_method,
            "transaction_ref": self.transaction_ref,
            "status": self.status,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None
        }
