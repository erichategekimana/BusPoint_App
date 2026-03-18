from flask import Blueprint, jsonify
from ..database import db
from ..models import Route, RouteStop, Stop
from ..auth import jwt_required, roles_required
from ..schemas import RouteCreateSchema, RouteStopSchema
from ..utils import validate_json, db_commit_or_rollback

route_bp = Blueprint('routes', __name__, url_prefix='/api/routes')

# --- READ ---

@route_bp.route('/', methods=['GET'])
def get_all_routes():
    """Returns a list of all routes and their stop sequences."""
    routes = Route.query.all()
    results = []
    for r in routes:
        route_data = r.to_dict()
        # Sort stops by order so the frontend sees a logical path
        route_data['path'] = [
            {"stop": rs.stop.name, "order": rs.stop_order} 
            for rs in sorted(r.route_stops, key=lambda x: x.stop_order)
        ]
        results.append(route_data)
    return jsonify(results), 200




@route_bp.route('/<uuid:route_id>', methods=['GET'])
def get_route_details(route_id):
    """Returns details for a single route, including its stops in order."""
    route = Route.query.get_or_404(route_id)
    route_data = route.to_dict()
    route_data['path'] = [
        {"stop": rs.stop.name, "order": rs.stop_order} 
        for rs in sorted(route.route_stops, key=lambda x: x.stop_order)
    ]
    return jsonify(route_data), 200


# (Admin Only)
@route_bp.route('/', methods=['POST'])
@jwt_required
@roles_required('admin')
@validate_json(RouteCreateSchema)
@db_commit_or_rollback
def create_route(validated_data: RouteCreateSchema):
    """Creates the 'Header' for a route."""
    new_route = Route(name=validated_data.name)
    db.session.add(new_route)
    db.session.flush() # Get the ID before committing
    return jsonify({"message": "Route created", "route": new_route.to_dict()}), 201

@route_bp.route('/<uuid:route_id>/stops', methods=['POST'])
@jwt_required
@roles_required('admin')
@validate_json(RouteStopSchema)
@db_commit_or_rollback
def add_stop_to_route(route_id, validated_data: RouteStopSchema):
    """Adds a specific stop to a route's sequence."""
    route = Route.query.get_or_404(route_id)
    stop = Stop.query.get_or_404(validated_data.stop_id)

    # Check if this stop order is already taken for this route
    existing = RouteStop.query.filter_by(route_id=route_id, stop_order=validated_data.stop_order).first()
    if existing:
        return jsonify({"error": "conflict", "message": f"Stop order {validated_data.stop_order} already exists"}), 409

    new_rs = RouteStop(
        route_id=route_id,
        stop_id=validated_data.stop_id,
        stop_order=validated_data.stop_order,
        estimated_minutes_from_start=validated_data.estimated_minutes_from_start
    )
    db.session.add(new_rs)
    return jsonify({"message": f"Stop {stop.name} added to route {route.name}"}), 201