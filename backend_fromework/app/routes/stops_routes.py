from flask import Blueprint, jsonify
from ..database import db
from ..models import Stop
from ..auth import jwt_required, roles_required
from ..schemas import StopCreateSchema
from ..utils import validate_json, db_commit_or_rollback

stop_bp = Blueprint('stops', __name__, url_prefix='/api/stops')

@stop_bp.route('/', methods=['GET'])
def get_all_stops():
    """Returns a list of all available stops for the search dropdowns."""
    stops = Stop.query.order_by(Stop.name).all()
    return jsonify([s.to_dict() for s in stops]), 200

@stop_bp.route('/', methods=['POST'])
@jwt_required
@roles_required('admin')
@validate_json(StopCreateSchema)
@db_commit_or_rollback
def create_stop(validated_data: StopCreateSchema):
    """Admin only: Add a new bus stop location."""
    new_stop = Stop(
        name=validated_data.name,
        latitude=validated_data.latitude,
        longitude=validated_data.longitude
    )
    db.session.add(new_stop)
    return jsonify({"message": "Stop created", "stop": new_stop.to_dict()}), 201