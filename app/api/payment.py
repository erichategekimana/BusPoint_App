from flask import Blueprint, request, jsonify
from app.models.payment_model import Payment
from app.models.booking_model import Booking
from app.database import db

payment_bp = Blueprint('payment_api', __name__, url_prefix='/api')

# Route to see payments
@payment_bp.route('/payments', methods=['GET'])
def get_payments():
    payments= Payment.query.all()
    return jsonify([p.to_dict() for p in payments]), 200

# Route to create a payment
@payment_bp.route('/payments', methods=['POST'])
def create_payment():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    new_payment = Payment(
         booking_id=data.get('booking_id'),
         amount=data.get('amount'),
         payment_method=data.get('payment_method'),
         transaction_ref=data.get('transaction_ref'),
         status= 'completed'
    )

    # Updating the booking status if payment is successful
    booking = Booking.query.get(data.get('booking_id'))
    if booking:
        booking.status = 'confirmed'

    db.session.add(new_payment)
    db.session.commit()

    return jsonify({"message": "Payment successful", "payment": new_payment.to_dict()}), 201
