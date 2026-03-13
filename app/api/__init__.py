from .bus import bus_bp
from .route import route_bp
from .route_stop import route_stop_bp
from .stop import stop_bp
from .user import user_bp

api_blueprints = [user_bp, bus_bp, route_bp, stop_bp, route_stop_bp]

__all__ = ["api_blueprints", "user_bp", "bus_bp", "route_bp", "stop_bp", "route_stop_bp"]
