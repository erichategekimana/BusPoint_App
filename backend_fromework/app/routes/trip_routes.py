# In trip_routes.py, replace the entire file with this corrected version:

from flask import Blueprint, jsonify, request, g
from ..database import db
from ..models import Trip, User, RouteStop, Stop
from sqlalchemy.orm import aliased
from ..auth import jwt_required, roles_required
from datetime import datetime, timedelta
from ..schemas import TripSearchSchema, TripCreateSchema
from ..models import Trip, Bus, Route
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
    date_str = request.args.get('travel_date')
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
        db.func.date(Trip.departure_time) == validated_data.travel_date,
        Trip.status == 'scheduled'
    ).all()

    return jsonify([trip.to_dict() for trip in trips]), 200


# This route is for getting detailed info about a specific trip, including the bus, route, and stops.
@trip_bp.route('/<uuid:trip_id>/details', methods=['GET'])
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
    data['bus_plate'] = trip.bus.plate_number
    data['bus_details'] = {
        "plate": trip.bus.plate_number,
        "capacity": trip.bus.capacity
    }
    
    # 3. Get all stops for this route in the correct order
    # We sort by 'stop_order' so the passenger sees the journey correctly
    data['itinerary'] = [
        {
            "stop_name": rs.stop.name,
            "stop_id": str(rs.stop.id),
            "arrival_order": rs.stop_order,
            "minutes_from_start": rs.estimated_minutes_from_start,
            "latitude": float(rs.stop.latitude),
            "longitude": float(rs.stop.longitude)
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
        status='scheduled',
        current_capacity=bus.capacity
    )
    db.session.add(new_trip)
    db.session.flush()  # Get the new trip ID before commit for the response
    db.session.refresh(new_trip)  # Refresh to get any defaults set by the database
    return jsonify({"message": "Trip scheduled successfully", "trip": new_trip.to_dict()}), 201



# Admin can update trip status (e.g., mark as delayed, completed, etc.)
@trip_bp.route('/<uuid:trip_id>/status', methods=['PATCH'])
@jwt_required
@roles_required('admin')
@db_commit_or_rollback
def update_trip_status(trip_id):
    """Update trip status (admin only)."""
    data = request.get_json()
    new_status = data.get('status')
    
    valid_statuses = ['scheduled', 'active', 'delayed', 'completed', 'cancelled']
    if new_status not in valid_statuses:
        return jsonify({"error": "bad_request", "message": "Invalid status"}), 400

    trip = Trip.query.get_or_404(trip_id)
    old_status = trip.status

    # Cannot directly set to 'active' without driver assignment
    if new_status == 'active' and not trip.driver_id:
        return jsonify({"error": "conflict", "message": "Cannot activate trip without assigning a driver"}), 400

    # If status is being changed from 'active' to something else, clear driver_id
    if old_status == 'active' and new_status != 'active':
        trip.driver_id = None

    # If status is being changed to 'completed' or 'cancelled', also clear driver_id if set
    if new_status in ['completed', 'cancelled'] and trip.driver_id:
        trip.driver_id = None

    trip.status = new_status
    return jsonify({"message": f"Trip status updated to {new_status}"}), 200


# get all trips (admin view) - this is a simple list without details, used for admin dashboards or lists
@trip_bp.route('/', methods=['GET'])
@jwt_required
def get_all_trips():
    """Returns all trips for admin lists."""
    trips = Trip.query.all()
    return jsonify([trip.to_dict() for trip in trips]), 200



# get active trips with itinerary (for passenger tracking) - this is a more detailed view used for the passenger app to show live tracking and itinerary
@trip_bp.route('/active', methods=['GET'])
@jwt_required
def get_active_trips():
    """Returns active trips for passenger tracking with full itinerary."""
    # We join with Bus and Route to get the readable names
    active_trips = db.session.query(Trip, Bus, Route)\
        .join(Bus, Trip.bus_id == Bus.id)\
        .join(Route, Trip.route_id == Route.id)\
        .filter(Trip.status.in_(['scheduled', 'delayed'])).all()
    
    results = []
    for trip, bus, route in active_trips:
        data = trip.to_dict()
        data['bus_plate'] = bus.plate_number
        data['route_name'] = route.name
        # Add itinerary for tracking display
        data['itinerary'] = [
            {
                "stop_name": rs.stop.name,
                "stop_id": str(rs.stop.id),
                "arrival_order": rs.stop_order,
                "minutes_from_start": rs.estimated_minutes_from_start,
                "latitude": float(rs.stop.latitude),
                "longitude": float(rs.stop.longitude)
            } 
            for rs in sorted(route.route_stops, key=lambda x: x.stop_order)
        ]
        results.append(data)
        
    return jsonify(results), 200


# Single trip endpoint - renamed to avoid conflict
@trip_bp.route('/<uuid:trip_id>', methods=['GET'])
@jwt_required
def get_single_trip(trip_id):
    """Get a single trip by ID (simple version without details)."""
    trip = Trip.query.get_or_404(trip_id)
    bus = Bus.query.get(trip.bus_id)
    route = Route.query.get(trip.route_id)
    
    data = trip.to_dict()
    data['bus_plate'] = bus.plate_number if bus else 'Unknown'
    data['route_name'] = route.name if route else 'Unknown'
    
    return jsonify(data), 200



# @trip_bp.route('/available', methods=['GET'])
# @jwt_required
# def get_available_trips():
#     trips = Trip.query.filter(Trip.status.in_(['scheduled', 'delayed'])).order_by(Trip.departure_time).all()
#     return jsonify([trip.to_dict() for trip in trips]), 200


# get_available_reips but assigned trips excluded
@trip_bp.route('/available', methods=['GET'])
@jwt_required
def get_available_trips():
    trips = Trip.query.filter(
        Trip.status == 'scheduled',
        Trip.driver_id.is_(None)
    ).order_by(Trip.departure_time).all()
    return jsonify([trip.to_dict() for trip in trips]), 200






# Driver claims a trip (only if it's scheduled and not already assigned)
@trip_bp.route('/<uuid:trip_id>/claim', methods=['POST'])
@jwt_required
@roles_required('driver')
@db_commit_or_rollback
def claim_trip(trip_id):
    driver_id = g.current_user['id']
    trip = Trip.query.get_or_404(trip_id)
    
    # Check if trip is already assigned
    if trip.driver_id is not None:
        return jsonify({"error": "conflict", "message": "Trip already assigned to another driver"}), 409
    
    # Check if trip status is scheduled
    if trip.status != 'scheduled':
        return jsonify({"error": "conflict", "message": f"Trip cannot be claimed because its status is '{trip.status}'"}), 409
    
    # Check if driver already has an active trip
    existing_active = Trip.query.filter(
        Trip.driver_id == driver_id,
        Trip.status == 'active'
    ).first()
    if existing_active:
        return jsonify({"error": "conflict", "message": "You already have an active trip"}), 409
    
    # Claim the trip
    trip.driver_id = driver_id
    trip.status = 'active'
    
    return jsonify({"message": "Trip claimed successfully", "trip": trip.to_dict()}), 200


# Get the active trip for the logged-in driver (if any)
@trip_bp.route('/my-active-trip', methods=['GET'])
@jwt_required
@roles_required('driver')
def get_my_active_trip():
    driver_id = g.current_user['id']
    trip = Trip.query.filter(
        Trip.driver_id == driver_id,
        Trip.status == 'active'
    ).first()
    
    if not trip:
        return jsonify({"message": "No active trip found"}), 404
    
    # Return detailed trip info (like /details endpoint)
    data = trip.to_dict()
    data['route_name'] = trip.route.name
    data['bus_plate'] = trip.bus.plate_number
    data['bus_details'] = {
        "plate": trip.bus.plate_number,
        "capacity": trip.bus.capacity
    }
    data['itinerary'] = [
        {
            "stop_name": rs.stop.name,
            "stop_id": str(rs.stop.id),
            "arrival_order": rs.stop_order,
            "minutes_from_start": rs.estimated_minutes_from_start,
            "latitude": float(rs.stop.latitude),
            "longitude": float(rs.stop.longitude)
        } 
        for rs in sorted(trip.route.route_stops, key=lambda x: x.stop_order)
    ]
    return jsonify(data), 200




# Driver can mark trip as completed (only if it's active and belongs to them)
@trip_bp.route('/<uuid:trip_id>/complete', methods=['POST'])
@jwt_required
@roles_required('driver')
@db_commit_or_rollback
def complete_trip(trip_id):
    driver_id = g.current_user['id']
    trip = Trip.query.get_or_404(trip_id)

    # Ensure trip belongs to this driver and is active
    if str(trip.driver_id) != driver_id:
        return jsonify({"error": "forbidden", "message": "This trip is not assigned to you"}), 403
    if trip.status != 'active':
        return jsonify({"error": "conflict", "message": f"Cannot complete trip with status '{trip.status}'"}), 409

    trip.status = 'completed'
    # Optionally set arrival_time
    if not trip.arrival_time:
        trip.arrival_time = datetime.utcnow()

    return jsonify({"message": "Trip marked as completed"}), 200


# Driver can cancel trip (only if it's active or scheduled and belongs to them)
@trip_bp.route('/<uuid:trip_id>/cancel', methods=['POST'])
@jwt_required
@roles_required('driver')
@db_commit_or_rollback
def cancel_trip(trip_id):
    driver_id = g.current_user['id']
    trip = Trip.query.get_or_404(trip_id)

    # Ensure trip belongs to this driver and is active (or maybe scheduled)
    if str(trip.driver_id) != driver_id:
        return jsonify({"error": "forbidden", "message": "This trip is not assigned to you"}), 403
    if trip.status not in ['scheduled', 'active']:
        return jsonify({"error": "conflict", "message": f"Cannot cancel trip with status '{trip.status}'"}), 409

    trip.status = 'cancelled'
    # Optionally clear driver assignment
    trip.driver_id = None

    return jsonify({"message": "Trip cancelled"}), 200


# Get occupied seats for a trip (for booking purposes)
@trip_bp.route('/<uuid:trip_id>/occupied-seats', methods=['GET'])
@jwt_required
def get_occupied_seats(trip_id):
    """
    Returns a list of seat numbers that are already occupied (confirmed or approved)
    for the given trip.
    """
    from ..models import Booking  # local import to avoid circular imports
    # Query bookings for this trip with status in ['confirmed', 'approved']
    bookings = Booking.query.filter(
        Booking.trip_id == trip_id,
        Booking.status.in_(['confirmed', 'approved'])
    ).all()
    occupied_seats = [b.seat_number for b in bookings]
    return jsonify({"seats": occupied_seats}), 200



# Get the trips that the logged-in user has booked (with status 'confirmed' or 'approved') and are still active (scheduled, delayed, active)
@trip_bp.route('/my-booked-trips', methods=['GET'])
@jwt_required
def get_my_booked_trips():
    from ..models import Booking
    user_id = g.current_user['id']

    # Get confirmed bookings (status 'confirmed' or 'approved')
    bookings = Booking.query.filter(
        Booking.user_id == user_id,
        Booking.status.in_(['confirmed', 'approved'])
    ).all()

    # Collect trip IDs
    trip_ids = [b.trip_id for b in bookings]
    if not trip_ids:
        return jsonify([]), 200

    # Fetch trips that are active (scheduled, delayed, active)
    trips = Trip.query.filter(
        Trip.id.in_(trip_ids),
        Trip.status.in_(['scheduled', 'delayed', 'active'])
    ).all()

    # Format with itinerary
    results = []
    for trip in trips:
        data = trip.to_dict()
        data['bus_plate'] = trip.bus.plate_number
        data['route_name'] = trip.route.name
        data['itinerary'] = [
            {
                "stop_name": rs.stop.name,
                "stop_id": str(rs.stop.id),
                "arrival_order": rs.stop_order,
                "minutes_from_start": rs.estimated_minutes_from_start
            }
            for rs in sorted(trip.route.route_stops, key=lambda x: x.stop_order)
        ]
        results.append(data)

    return jsonify(results), 200



# assign driver to trip (admin only) - this is used when an admin wants to manually assign a driver to a trip and activate it, instead of the driver claiming it themselves. This allows for more control in case of special circumstances.
@trip_bp.route('/<uuid:trip_id>/assign-driver', methods=['POST'])
@jwt_required
@roles_required('admin')
@db_commit_or_rollback
def assign_driver_to_trip(trip_id):
    """Assign a driver to a trip and set status to active."""
    data = request.get_json()
    driver_id = data.get('driver_id')
    if not driver_id:
        return jsonify({"error": "bad_request", "message": "driver_id required"}), 400

    trip = Trip.query.get_or_404(trip_id)
    if trip.status != 'scheduled':
        return jsonify({"error": "conflict", "message": f"Cannot assign driver to trip with status '{trip.status}'"}), 409
    if trip.driver_id:
        return jsonify({"error": "conflict", "message": "Trip already has a driver assigned"}), 409

    driver = User.query.get(driver_id)
    if not driver or driver.role != 'driver':
        return jsonify({"error": "not_found", "message": "Driver not found"}), 404

    # Check if driver is already on an active trip
    existing_active = Trip.query.filter_by(driver_id=driver_id, status='active').first()
    if existing_active:
        return jsonify({"error": "conflict", "message": "Driver already has an active trip"}), 409

    trip.driver_id = driver_id
    trip.status = 'active'
    return jsonify({"message": "Driver assigned and trip activated", "trip": trip.to_dict()}), 200
