from flask import Blueprint, jsonify, request, g
from ..database import db
from ..models import Trip, User, RouteStop, Stop
from sqlalchemy.orm import aliased
from ..auth import jwt_required, roles_required
from datetime import datetime, timedelta
from ..schemas import TripSearchSchema, TripCreateSchema
from ..utils import validate_query, db_commit_or_rollback, validate_json


# create the blueprint
trip_bp = Blueprint('trips', __name__, url_prefix='/api/trips')


@trip_bp.route('/search', methods=['GET'])
@validate_query(TripSearchSchema)
def search_trips(validated_data: TripSearchSchema):
    """
    Search for trips based on origin, destination, and date.
    The validated_data object now contains clean, typed data.
    """

    # ----- future use maybe-----
    origin_id = request.args.get('origin_id')
    dest_id = request.args.get('dest_id')
    date_str = request.args.get('date')
    #-----------------------


    OriginRS = aliased(RouteStop)
    DestRS = aliased(RouteStop)


    # 1. Find routes that contain BOTH the origin and destination
    # We use the names from your schema: origin_id and dest_id
    valid_routes = db.session.query(OriginRS.route_id)\
        .join(DestRS, OriginRS.route_id == DestRS.route_id)\
        .filter(
            OriginRS.stop_id == validated_data.origin_id,
            DestRS.stop_id == validated_data.dest_id,
            OriginRS.stop_order < DestRS.stop_order # Ensure correct direction
        ).subquery()

    # 2. Fetch trips. 
    # validated_data.date is already a Python 'date' object thanks to Pydantic!
    trips = Trip.query.filter(
        Trip.route_id.in_(valid_routes),
        db.func.date(Trip.departure_time) == validated_data.date,
        Trip.status == 'scheduled'
    ).all()

    return jsonify([trip.to_dict() for trip in trips]), 200




# This route is for getting detailed info about a specific trip, including the bus, route, and stops.
@trip_bp.route('/<uuid:trip_id>', methods=['GET'])
def get_trip_details(trip_id):
    """
    Returns full info for a single trip.
    Used when a user selects a specific bus from the search results.
    """
    # 1. Fetch the trip or return 404 if the ID is fake
    trip = Trip.query.get_or_404(trip_id)
    
    # 2. Build a detailed response
    data = trip.to_dict()
    data['route_name'] = trip.route.name
    data['bus_details'] = {
        "plate": trip.bus.plate_number,
        "capacity": trip.bus.capacity
    }
    
    # 3. Get all stops for this route in the correct order
    # We sort by 'stop_order' so the passenger sees the journey correctly
    data['itinerary'] = [
        {
            "stop_name": rs.stop.name,
            "arrival_order": rs.stop_order,
            "minutes_from_start": rs.estimated_minutes_from_start
        } 
        for rs in sorted(trip.route.route_stops, key=lambda x: x.stop_order)
    ]
    
    return jsonify(data), 200



@trip_bp.route('/', methods=['POST'])
@jwt_required
@roles_required('admin')
@validate_json(TripCreateSchema)
@db_commit_or_rollback
def create_trip(validated_data: TripCreateSchema):
    """
    Schedule a new trip. 
    Checks if the bus is already busy at that time.
    """
    # 1. Verify Bus and Route exist
    from ..models import Bus, Route # Local import to avoid circularity if needed
    bus = Bus.query.get_or_404(validated_data.bus_id)
    route = Route.query.get_or_404(validated_data.route_id)

    # 2. Basic Conflict Check: Is this bus already assigned to a trip within 2 hours?
    buffer_time = timedelta(hours=2)
    start_window = validated_data.departure_time - buffer_time
    end_window = validated_data.departure_time + buffer_time
    
    conflict = Trip.query.filter(
        Trip.bus_id == bus.id,
        Trip.departure_time.between(start_window, end_window)
    ).first()

    if conflict:
        return jsonify({
            "error": "conflict", 
            "message": f"Bus {bus.plate_number} is already scheduled for a trip near this time."
        }), 409

    # 3. Create the trip
    new_trip = Trip(
        bus_id=validated_data.bus_id,
        route_id=validated_data.route_id,
        departure_time=validated_data.departure_time,
        price=validated_data.price,
        status='scheduled'
    )
    db.session.add(new_trip)
    return jsonify({"message": "Trip scheduled successfully", "trip": new_trip.to_dict()}), 201

@trip_bp.route('/<uuid:trip_id>/status', methods=['PATCH'])
@jwt_required
@roles_required('admin')
@db_commit_or_rollback
def update_trip_status(trip_id):
    """Update trip status (e.g., 'delayed', 'completed', 'cancelled')."""
    data = request.get_json()
    new_status = data.get('status')
    
    valid_statuses = ['scheduled', 'delayed', 'completed', 'cancelled']
    if new_status not in valid_statuses:
        return jsonify({"error": "bad_request", "message": "Invalid status"}), 400

    trip = Trip.query.get_or_404(trip_id)
    trip.status = new_status
    return jsonify({"message": f"Trip status updated to {new_status}"}), 200