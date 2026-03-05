from functools import wraps
from flask import request, jsonify
from pydantic import ValidationError

def validate_json(schema):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                payload = request.get_json(force=True)
            except Exception:
                return jsonify({"error": "Invalid or missing JSON body"}), 400

            try:
                validated = schema(**payload)
            except ValidationError as e:
                # Pydantic provides a nice list of errors
                return jsonify({"error": "validation_error", "details": e.errors()}), 400

            # Pass the validated model to the view as `validated`
            return fn(validated, *args, **kwargs)
        return wrapper
    return decorator

from functools import wraps
from .database import db

def db_commit_or_rollback(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            result = fn(*args, **kwargs)
            db.session.commit()
            return result
        except Exception as e:
            db.session.rollback()
            # re-raise so Flask error handler can produce 500 or handle accordingly
            raise
    return wrapper
