from functools import wraps

from flask import jsonify, request
from pydantic import ValidationError

from .database import db


def validate_json(schema):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            payload = request.get_json(silent=True)
            if payload is None:
                return jsonify({"error": "Invalid or missing JSON body"}), 400

            try:
                validated = schema.model_validate(payload)
            except ValidationError as exc:
                return jsonify({"error": "validation_error", "details": exc.errors()}), 400

            kwargs["validated"] = validated
            return fn(*args, **kwargs)  # no type-annotated param needed on the route side

        return wrapper
    return decorator

def db_commit_or_rollback(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            result = fn(*args, **kwargs)
            db.session.commit()
            return result
        except Exception:
            db.session.rollback()
            raise

    return wrapper
