from flask import Blueprint, jsonify
from app.models.trip_model import Trip

trip_bp = Blueprint('trip_api', __name__, url_prefix='/api')

@trip_bp.route('/trips', methods=['GET'])
def list_trips():
    # Only show trips that are 'scheduled' or 'active'
    trips = Trip.query.filter_by(status='scheduled').all()

    return jsonify([t.to_dict() for t in trips]), 200
