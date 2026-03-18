from flask import Blueprint, jsonify, g
from ..database import db
from ..models import Notification
from ..auth import jwt_required, roles_required
from ..schemas import NotificationCreateSchema
from ..utils import validate_json, db_commit_or_rollback

notification_bp = Blueprint('notifications', __name__, url_prefix='/api/notifications')

@notification_bp.route('/', methods=['GET'])
@jwt_required
def get_my_notifications():
    """Returns all notifications for the logged-in user, newest first."""
    user_id = g.current_user['id']
    # We query the table you defined in your SQL
    notifications = Notification.query.filter_by(user_id=user_id)\
        .order_by(Notification.created_at.desc()).all()
    
    return jsonify([n.to_dict() for n in notifications]), 200

@notification_bp.route('/<uuid:notification_id>/read', methods=['PATCH'])
@jwt_required
@db_commit_or_rollback
def mark_as_read(notification_id):
    """Marks a specific notification as 'ready' or seen."""
    notification = Notification.query.get_or_404(notification_id)
    
    # Security: Ensure user only marks their own notifications
    if str(notification.user_id) != g.current_user['id']:
        return jsonify({"error": "forbidden"}), 403
        
    notification.is_ready = True # Using the column from your SQL
    return jsonify({"message": "Notification marked as read"}), 200



@notification_bp.route('/admin/send', methods=['POST'])
@jwt_required
@roles_required('admin')
@validate_json(NotificationCreateSchema)
@db_commit_or_rollback
def send_manual_notification(validated_data: NotificationCreateSchema):
    """Admin only: Send a specific message to a user."""
    new_notif = Notification(
        user_id=validated_data.user_id,
        title=validated_data.title,
        message=validated_data.message,
        type=validated_data.notification_type
    )
    db.session.add(new_notif)
    return jsonify({"message": "Notification sent"}), 201