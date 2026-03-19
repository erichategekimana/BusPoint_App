from flask import Flask, jsonify
from flask_cors import CORS
from flask_migrate import Migrate
from config import Config
from .database import db, init_db

migrate = Migrate()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialize database
    init_db(app)
    migrate.init_app(app, db)


    # Enable CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Here we register error handles
    register_error_handlers(app)

    # After db is ready, we import all blueprints
    from app.routes.auth_routes import auth_bp
    from app.routes.trip_routes import trip_bp
    from app.routes.booking_routes import booking_bp
    from app.routes.bus_routes import bus_bp
    from app.routes.bus_location_routes import loc_bp
    from app.routes.route_routes import route_bp
    from app.routes.notification_routes import notification_bp
    from app.routes.payment_routes import payment_bp
    from app.routes.stop_routes import stop_bp 
#    >
#    >
#    >
#    >
#    >
#    ...

    # register endpoints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(trip_bp, url_prefix='/api/trips')
    app.register_blueprint(booking_bp, url_prefix='/api/bookings')
    app.register_blueprint(bus_bp, url_prefix='/api/buses')
    app.register_blueprint(loc_bp, url_prefix='/api/locations')
    app.register_blueprint(route_bp, url_prefix='/api/routes')
    app.register_blueprint(notification_bp, url_prefix='/api/notifications')
    app.register_blueprint(payment_bp, url_prefix='/api/payments')
    app.register_blueprint(stop_bp, url_prefix='/api/stops')
#    >
#    >
#    >
#    >
#    >
#    ...

    def shutdown_session(exception=None):
        db.session.remove()
    return app


# 
def register_error_handlers(app):
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": "bad_request", "message": str(e)}), 400

    @app.errorhandler(401)
    def unauthorized(e):
        return jsonify({"error": "unauthorized", "message": str(e)}), 401

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "not_found", "message": "Resource not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "method_not_allowed"}), 405

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"error": "internal_server_error", "message": str(e)}), 500

















