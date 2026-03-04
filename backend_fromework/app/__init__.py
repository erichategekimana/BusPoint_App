from flask import Flask, jsonfy
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
    >
    >
    >
    >
    >
    >
    ...

    # register endpoints
    >
    >
    >
    >
    >
    ...

    def shutdown_session(exception=None):
        db.session.remove()
    return app


# 

















