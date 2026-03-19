from flask import Blueprint, jsonify, g
from ..database import db
from ..models import Stop
from ..auth import jwt_required, roles_required
from ..schemas import StopCreateSchema, NearbySearchSchema
from sqlalchemy import func
from ..utils import validate_query, validate_json, db_commit_or_rollback
from ..utils import validate_json, db_commit_or_rollback

stop_bp = Blueprint('stops', __name__, url_prefix='/api/stops')

# --- READ ---

@stop_bp.route('/', methods=['GET'])
def get_all_stops():
    """Returns all stops for dropdowns/lists."""
    stops = Stop.query.order_by(Stop.name).all()
    return jsonify([s.to_dict() for s in stops]), 200

@stop_bp.route('/<uuid:stop_id>', methods=['GET'])
def get_stop_details(stop_id):
    """Returns details for one specific stop."""
    stop = Stop.query.get_or_404(stop_id)
    return jsonify(stop.to_dict()), 200

# --- WRITE (Admin Only) ---

@stop_bp.route('/', methods=['POST'])
@jwt_required
@roles_required('admin')
@validate_json(StopCreateSchema)
@db_commit_or_rollback
def create_stop(validated_data: StopCreateSchema):
    new_stop = Stop(
        name=validated_data.name,
        latitude=validated_data.latitude,
        longitude=validated_data.longitude
    )
    db.session.add(new_stop)
    return jsonify({"message": "Stop created", "stop": new_stop.to_dict()}), 201

@stop_bp.route('/<uuid:stop_id>', methods=['PUT'])
@jwt_required
@roles_required('admin')
@validate_json(StopCreateSchema)
@db_commit_or_rollback
def update_stop(validated_data: StopCreateSchema, stop_id: str):
    """Update an existing stop's name or coordinates."""
    stop = Stop.query.get_or_404(stop_id)
    
    stop.name = validated_data.name
    stop.latitude = validated_data.latitude
    stop.longitude = validated_data.longitude
    
    return jsonify({"message": "Stop updated", "stop": stop.to_dict()}), 200

@stop_bp.route('/<uuid:stop_id>', methods=['DELETE'])
@jwt_required
@roles_required('admin')
@db_commit_or_rollback
def delete_stop(stop_id):
    """Delete a stop if it's not currently being used in any active routes."""
    stop = Stop.query.get_or_404(stop_id)
    
    # Check if this stop is used in any routes
    if stop.route_stops:
        return jsonify({
            "error": "conflict", 
            "message": "Cannot delete stop because it is part of an existing route."
        }), 409
        
    db.session.delete(stop)
    return jsonify({"message": "Stop deleted successfully"}), 200




@stop_bp.route('/nearby', methods=['GET'])
@validate_query(NearbySearchSchema)
def get_nearby_stops(validated_data: NearbySearchSchema):
    """
    Finds bus stops within a certain radius of the user's GPS coordinates.
    Example: /api/stops/nearby?lat=-1.94&lon=30.06&radius_km=1.5
    """
    # Earth's radius in kilometers
    R = 6371.0 
    
    user_lat = validated_data.lat
    user_lon = validated_data.lon
    radius = validated_data.radius_km

    # Haversine formula in SQLAlchemy
    # just doing the math inside the database for speed
    distance_formula = (
        R * func.acos(
            func.cos(func.radians(user_lat)) * func.cos(func.radians(Stop.latitude)) * func.cos(func.radians(Stop.longitude) - func.radians(user_lon)) + 
            func.sin(func.radians(user_lat)) * func.sin(func.radians(Stop.latitude))
        )
    )

    # Query stops, calculate distance, filter by radius, and sort by closest
    nearby_stops = db.session.query(Stop, distance_formula.label('distance'))\
        .filter(distance_formula <= radius)\
        .order_by('distance')\
        .all()

    results = []
    for stop, dist in nearby_stops:
        stop_data = stop.to_dict()
        stop_data['distance_km'] = round(dist, 2)
        results.append(stop_data)

    return jsonify(results), 200