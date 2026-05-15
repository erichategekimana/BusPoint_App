from flask import Blueprint, jsonify, request
from ..database import db
from ..models import Bus
from ..auth import jwt_required, roles_required
from ..schemas import BusCreateSchema
from ..utils import validate_json, db_commit_or_rollback

bus_bp = Blueprint('buses', __name__, url_prefix='/api/buses')

# (Admin Only) ---

@bus_bp.route('/', methods=['GET'])
@jwt_required
@roles_required('admin')
def get_all_buses():
    """List all vehicles in the fleet."""
    buses = Bus.query.all()
    return jsonify([b.to_dict() for b in buses]), 200

# --- WRITE (Admin Only) ---

@bus_bp.route('/', methods=['POST'])
@jwt_required
@roles_required('admin')
@validate_json(BusCreateSchema)
@db_commit_or_rollback
def create_bus(validated_data: BusCreateSchema):
    """Register a new bus into the system."""
    # Check if plate number already exists to avoid duplicates
    existing = Bus.query.filter_by(plate_number=validated_data.plate_number).first()
    if existing:
        return jsonify({"error": "conflict", "message": "Bus plate already registered"}), 409

    new_bus = Bus(
        plate_number=validated_data.plate_number,
        capacity=validated_data.capacity,
        bus_type=validated_data.bus_type
    )
    db.session.add(new_bus)
    return jsonify({"message": "Bus registered", "bus": new_bus.to_dict()}), 201

@bus_bp.route('/<uuid:bus_id>', methods=['DELETE'])
@jwt_required
@roles_required('admin')
@db_commit_or_rollback
def delete_bus(bus_id):
    """Remove a bus from the fleet if it has no scheduled trips."""
    bus = Bus.query.get_or_404(bus_id)
    
    # Check if this bus is assigned to any trips
    if bus.trips:
        return jsonify({
            "error": "conflict", 
            "message": "Cannot delete bus assigned to active trips."
        }), 409
        
    db.session.delete(bus)
    return jsonify({"message": "Bus removed from fleet"}), 200



@bus_bp.route('/<uuid:bus_id>', methods=['PUT'])
@jwt_required
@roles_required('admin')
@db_commit_or_rollback
def update_bus(bus_id):
    """Update bus details (currently only toggles is_active)."""
    data = request.get_json()
    bus = Bus.query.get_or_404(bus_id)
    
    # Only allow updating is_active for now (or extend as needed)
    if 'is_active' in data:
        bus.is_active = data['is_active']
    
    return jsonify({"message": "Bus updated", "bus": bus.to_dict()}), 200