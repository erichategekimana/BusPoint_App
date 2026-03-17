from flask import Blueprint, request, jsonify
from app.models.booking_model import Booking # type: ignore
from app.database import db # type: ignore
import uuid

 # Blueprint
booking_bp =Blueprint('booking_api', __name__, url_prefix='/api')

 # Get all bookings 
@booking_bp.route('/bookings', methods=['GET'])
def get_bookings():
    bookings = Booking.query.all()
    return jsonify([b.to_dict() for b in bookings]), 200

 # create a new booking
@booking_bp.route('/bookings', methods=['POST'])
def create_booking():
    data = request.get_json()

    # Creating new instance using the data from the frontend
    new_booking = Booking(
    user_id=data.get('user_id'), # type: ignore
    trip_id=data.get('trip_id'),
    seat_number=data.get('seat_number'),
    pickup_stop_id=data.get('pickup_stop_id'),
    dropoff_stop_id=data.get('dropoff_stop_id'),
    status= 'pending'
    )

    db.session.add(new_booking)
    db.session.commit()

    return jsonify({"message": "Booking created", "booking": new_booking.to_dict()}), 201
