from flask import Blueprint, jsonify, request, g
from ..database import db
from ..models import Trip, User, RouteStop, Stop
from ..auth import jwt_required, roles_required
from datetime import datetime, timedelta
from ..schemas import TripSearchSchema
from ..utils import validate_query, db_commit_or_rollback


# create the blueprint
trip_bp = Blueprint('trips', __name__, url_prefix='/api/trips')


@trip_bp.route('/search', methods=['GET'])
@validate_query(TripSearchSchema)
def search_trips(validated_data: TripSearchSchema):
    """
    Search for trips based on origin, destination, and date.
    The validated_data object now contains clean, typed data.
    """
    origin_id = request.args.get('origin_id')
    dest_id = request.args.get('dest_id')
    date_str = request.args.get('date')

    # 1. Find routes that contain BOTH the origin and destination
    # We use the names from your schema: origin_id and dest_id
    subquery = db.session.query(RouteStop.route_id)\
        .join(Stop, RouteStop.stop_id == Stop.id)\
        .filter(RouteStop.stop_id == validated_data.origin_id)\
        .intersect(
            db.session.query(RouteStop.route_id)\
            .filter(RouteStop.stop_id == validated_data.dest_id)
        ).subquery()

    # 2. Fetch trips. 
    # validated_data.date is already a Python 'date' object thanks to Pydantic!
    trips = Trip.query.filter(
        Trip.route_id.in_(subquery),
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