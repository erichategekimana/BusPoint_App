from flask import Blueprint, jsonify, request, g
import uuid
from datetime import datetime, timezone
from ..database import db
from ..models import Payment, Booking, Trip
from ..auth import jwt_required
from ..schemas import PaymentInitializeSchema
from ..utils import validate_json, db_commit_or_rollback

payment_bp = Blueprint('payments', __name__, url_prefix='/api/payments')

@payment_bp.route('/initialize', methods=['POST'])
@jwt_required
@validate_json(PaymentInitializeSchema)
@db_commit_or_rollback
def initialize_payment(validated_data: PaymentInitializeSchema):
    """
    Step 1: The user requests to pay for a booking.
    This simulates sending the push request to MTN MoMo.
    """
    booking = Booking.query.get_or_404(validated_data.booking_id)
    
    # Security: Make sure they own the booking and it's not already paid
    if str(booking.user_id) != g.current_user['id']:
        return jsonify({"error": "forbidden"}), 403
    if booking.status == 'confirmed':
        return jsonify({"error": "conflict", "message": "Booking is already paid"}), 409

    trip = Trip.query.get(booking.trip_id)
    
    # Create a pending payment record
    # uuid.uuid4().hex gives us a random transaction ID like a real bank would
    transaction_ref = f"MOMO-{uuid.uuid4().hex[:10].upper()}"
    
    new_payment = Payment(
        booking_id=booking.id,
        amount=trip.route.base_price,  # Use the base price from the route
        currency='RWF',
        payment_method='MTN_MOMO',
        transaction_ref=transaction_ref,
        status='pending'
    )
    
    db.session.add(new_payment)
    
    # IN A REAL APP: Here is where you use the 'requests' library to call the MTN API.
    # For now, we return the transaction_ref so we can manually trigger the webhook.
    
    return jsonify({
        "message": "Payment initiated. Check your phone for the MoMo prompt.",
        "transaction_ref": transaction_ref,
        "amount": trip.route.base_price
    }), 200

@payment_bp.route('/webhook/momo', methods=['POST'])
@db_commit_or_rollback
def momo_webhook():
    """
    Step 2: MTN's servers call this endpoint when the user enters their PIN.
    Notice there is NO @jwt_required here. The user's phone isn't making this request, MTN is.
    """
    data = request.get_json()
    
    # Expected data from the mock MoMo API
    transaction_ref = data.get('transaction_ref')
    momo_status = data.get('status') # 'SUCCESSFUL' or 'FAILED'
    
    payment = Payment.query.filter_by(transaction_ref=transaction_ref).first()
    if not payment:
        return jsonify({"error": "not_found"}), 404
        
    if momo_status == 'SUCCESSFUL':
        payment.status = 'successful'
        payment.paid_at = datetime.now(timezone.utc)
        
        # Now that we have money, confirm the ticket!
        booking = Booking.query.get(payment.booking_id)
        booking.status = 'confirmed'
        # reduce trip capacity
        trip = Trip.query.get(booking.trip_id)
        if trip.capacity > 0:
            trip.capacity -= 1
        else:
            # handle edge case if paid but full - refund logic would go here in a real app

            pass
        
    else:
        payment.status = 'failed'
        # The booking remains 'pending' so they can try again.

    # Always return 200 OK to webhooks so the MoMo server knows we received it
    return jsonify({"message": "Webhook processed"}), 200