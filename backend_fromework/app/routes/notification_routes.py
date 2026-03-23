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




@notification_bp.route('/admin/broadcast', methods=['POST'])
@jwt_required
@roles_required('admin')
def broadcast_notification():
    data = request.get_json()
    target = data.get('target')  # 'all', 'passengers', 'drivers'
    title = data.get('title')
    message = data.get('message')
    notif_type = data.get('notification_type', 'info')
    
    if not title or not message:
        return jsonify({"error": "missing fields"}), 400
    
    # Determine users based on target
    from ..models import User
    query = User.query
    if target == 'passengers':
        query = query.filter(User.role == 'passenger')
    elif target == 'drivers':
        query = query.filter(User.role == 'driver')
    # else 'all' includes everyone
    
    users = query.all()
    for user in users:
        notif = Notification(
            user_id=user.id,
            title=title,
            message=message,
            type=notif_type
        )
        db.session.add(notif)
    db.session.commit()
    return jsonify({"message": f"Notification sent to {len(users)} users"}), 201
