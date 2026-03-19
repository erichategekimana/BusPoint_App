import secrets
from flask import Blueprint, jsonify, g
from ..database import db
from ..models import Booking, Trip
from ..auth import jwt_required
from ..schemas import BookingCreateSchema
from ..utils import validate_json, db_commit_or_rollback

booking_bp = Blueprint('bookings', __name__, url_prefix='/api/bookings')

@booking_bp.route('/', methods=['POST'])
@jwt_required
@validate_json(BookingCreateSchema)
@db_commit_or_rollback
def create_booking(validated_data: BookingCreateSchema):
    """Creates a new booking and generates a unique ticket token."""
    
    # 1. Check if the trip exists
    trip = Trip.query.get_or_404(validated_data.trip_id)
    
    # 2. Check if seat is already taken for this trip
    existing_booking = Booking.query.filter_by(
        trip_id=validated_data.trip_id,
        seat_number=validated_data.seat_number,
        status='pending'
    ).first()
    
    if existing_booking:
        return jsonify({"error": "conflict", "message": "Seat already reserved"}), 409

    # 3. Create the booking
    # secrets.token_hex(8) creates a short, unique code like '4f2e9a1b' for the ticket
    new_booking = Booking(
        user_id=g.current_user['id'],
        trip_id=validated_data.trip_id,
        seat_number=validated_data.seat_number,
        pickup_stop_id=validated_data.pickup_stop_id,
        dropoff_stop_id=validated_data.dropoff_stop_id,
        status='pending',
        ticket_token=secrets.token_hex(8).upper()
    )
    
    db.session.add(new_booking)
    db.session.flush() # Sync with DB to get the UUID before the final commit
    
    return jsonify({
        "message": "Booking successful",
        "booking": new_booking.to_dict()
    }), 201

@booking_bp.route('/me', methods=['GET'])
@jwt_required
def get_my_bookings():
    """Returns all bookings for the logged-in user."""
    user_id = g.current_user['id']
    bookings = Booking.query.filter_by(user_id=user_id).all()
    
    return jsonify([b.to_dict() for b in bookings]), 200

@booking_bp.route('/<uuid:booking_id>/cancel', methods=['PUT'])
@jwt_required
@db_commit_or_rollback
def cancel_booking(booking_id):
    """Soft-deletes a booking by changing its status."""
    booking = Booking.query.get_or_404(booking_id)
    
    # Security check: Ensure user owns this booking
    if str(booking.user_id) != g.current_user['id']:
        return jsonify({"error": "forbidden", "message": "Unauthorized"}), 403
        
    booking.status = 'cancelled'
    return jsonify({"message": "Booking cancelled"}), 200