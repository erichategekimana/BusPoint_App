from flask import Blueprint, jsonify, request
from sqlalchemy import func
from datetime import datetime, date
from ..database import db
from ..models import User, Trip, Booking, Payment
from datetime import timedelta
from ..auth import jwt_required, roles_required

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

@admin_bp.route('/stats', methods=['GET'])
@jwt_required
@roles_required('admin')
def get_stats():
    total_users = User.query.count()
    active_trips = Trip.query.filter(Trip.status.in_(['scheduled', 'delayed'])).count()
    
    today = date.today()
    # Count bookings created today (using created_at)
    today_bookings = Booking.query.filter(func.date(Booking.created_at) == today).count()
    
    # Sum payments that are successful and paid today (using paid_at)
    today_revenue = db.session.query(func.sum(Payment.amount)) \
        .filter(func.date(Payment.paid_at) == today, Payment.status == 'successful') \
        .scalar() or 0
    
    return jsonify({
        'totalUsers': total_users,
        'activeTrips': active_trips,
        'todayBookings': today_bookings,
        'revenue': today_revenue
    }), 200

@admin_bp.route('/recent-activity', methods=['GET'])
@jwt_required
@roles_required('admin')
def get_recent_activity():
    # Parse query params
    limit = request.args.get('limit', default=5, type=int)
    days = request.args.get('days', default=3, type=int)
    since_date = datetime.utcnow() - timedelta(days=days)

    # Get bookings from last 'days' days
    recent_bookings = Booking.query.filter(Booking.created_at >= since_date)\
        .order_by(Booking.created_at.desc()).limit(limit).all()
    
    # Get new users from last 'days' days
    recent_users = User.query.filter(User.created_at >= since_date)\
        .order_by(User.created_at.desc()).limit(limit).all()
    
    # Combine and sort by time descending
    activities = []
    for booking in recent_bookings:
        user_name = booking.user.full_name if booking.user else 'Unknown'
        route_name = booking.trip.route.name if booking.trip and booking.trip.route else 'Unknown'
        activities.append({
            'type': 'booking',
            'message': f"New booking on {route_name} by {user_name}",
            'time': booking.created_at.isoformat(),
            'icon': 'ticket-alt',
            'color': 'primary'
        })
    for user in recent_users:
        activities.append({
            'type': 'user',
            'message': f"New user registered: {user.full_name}",
            'time': user.created_at.isoformat(),
            'icon': 'user',
            'color': 'info'
        })
    # Sort by time descending
    activities.sort(key=lambda x: x['time'], reverse=True)
    # Return top 'limit' items
    return jsonify(activities[:limit]), 200