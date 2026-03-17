 from flask import Blueprint, jsonify, request
 from app.models.notification_model import Notification
 from app.database import db

 notification_bp = Blueprint('notification_bp', __name__)

 @notification_bp.route('notification/<uuid:user_id>', methods=['GET'])
 def get_user_notifications(user_id):

     # Fetch notifications for a specific user
     notifications= Notification.query.filter_by(user_id=user_id).order_by(Notification.created_at.desc()).all()
     return jsonify([n.to_dict() for n in notification]), 200

 @notification_bp.route('/notifications/<uuid:id>/read', methods=['PATCH'])
 def mark_as_read(id):
     notification = Notification.query.get(id)
     if not notification:
         return jsonify({"error": "Notification not found"}), 404


     notification.is_ready = True
     db.session.commit()
     return jsonify({"message": "Marked as read"}), 200
