from .bus import bus_bp
from .route import route_bp
from .route_stop import route_stop_bp
from .stop import stop_bp
from .user import user_bp
from .trip import trip_bp
from .booking import booking_bp
from .payment import payment_bp
from .notification import notification_bp
from .bus_location import bus_location_bp

api_blueprints = [user_bp, bus_bp, route_bp, stop_bp, route_stop_bp, trip_bp, booking_bp, payment_bp, notification_bp, bus_location_bp]

__all__ = ["api_blueprints", "user_bp", "bus_bp", "route_bp", "stop_bp", "route_stop_bp", "trip_bp", "booking_bp", "payment_bp", "notification_bp", "bus_location_bp"]
