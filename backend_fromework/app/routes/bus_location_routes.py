from flask import Blueprint, jsonify, g
from ..database import db
from ..models import Trip
from ..auth import jwt_required, roles_required
from ..schemas import BusLocationUpdateSchema
from ..utils import validate_json, db_commit_or_rollback

loc_bp = Blueprint('locations', __name__, url_prefix='/api/locations')

@loc_bp.route('/<uuid:trip_id>/update', methods=['POST'])
@jwt_required
@roles_required('driver', 'admin') # Only the driver or admin can move the bus!
@validate_json(BusLocationUpdateSchema)
@db_commit_or_rollback
def update_location(validated_data: BusLocationUpdateSchema, trip_id: str):
    """
    Called by the Driver's app every 10 seconds.
    Updates the current GPS position of the bus for a specific trip.
    """
    trip = Trip.query.get_or_404(trip_id)
    trip.current_lat = validated_data.latitude
    trip.current_lon = validated_data.longitude
    if validated_data.speed is not None:
        trip.current_speed = validated_data.speed
    return jsonify({"status": "success", "message": "Location updated"}), 200

@loc_bp.route('/<uuid:trip_id>', methods=['GET'])
def get_bus_location(trip_id):
    """
    Called by the Passenger's app to see where the bus is right now.
    """
    trip = Trip.query.get_or_404(trip_id)
    if trip.current_lat is None or trip.current_lon is None:
        return jsonify({"message": "Location not yet available for this trip"}), 404

    return jsonify({
        "trip_id": trip.id,
        "latitude": trip.current_lat,
        "longitude": trip.current_lon,
        "status": trip.status,
        "speed": trip.current_speed or 0
    }), 200