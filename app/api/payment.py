from flask import Blueprint, request, jsonify
from app.models.payment_model import Payment
from app.models.booking_model import Booking
from app.database import db

payment_bp = Blueprint('payment_api', __name__, url_prefix='/api')

@payment_bp.route('/payments', methods=['POST'])
def process_payment():
    data = request.get_json()

    new_payment = Payment(
         booking_id=data.get('booking_id'),
         amount=data.get('amaount'),
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
