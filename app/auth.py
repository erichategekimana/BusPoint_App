import jwt
from datetime import datetime
from functools import wraps

from flask import current_app, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash


def hash_password(plain: str) -> str:
    return generate_password_hash(plain)


def verify_password(password_hash: str, plain: str) -> bool:
    return check_password_hash(password_hash, plain)


def create_access_token(identity: dict) -> str:
    secret = current_app.config["JWT_SECRET"]
    algorithm = current_app.config["JWT_ALGORITHM"]
    expires = datetime.utcnow() + current_app.config["JWT_ACCESS_TOKEN_EXPIRES"]

    payload = {
        "sub": identity,
        "exp": expires,
        "iat": datetime.utcnow(),
    }
    token = jwt.encode(payload, secret, algorithm=algorithm)
    if isinstance(token, bytes):
        return token.decode("utf-8")
    return token


def decode_token(token: str):
    secret = current_app.config["JWT_SECRET"]
    algorithm = current_app.config["JWT_ALGORITHM"]
    try:
        return jwt.decode(token, secret, algorithms=[algorithm])
    except jwt.ExpiredSignatureError:
        return {"error": "token_expired"}
    except jwt.InvalidTokenError:
        return {"error": "invalid_token"}


def jwt_required(roles: set[str] | None = None):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            auth_header = request.headers.get("Authorization")
            if not auth_header:
                return jsonify({"error": "authorization_header_missing"}), 401

            parts = auth_header.split()
            if len(parts) != 2 or parts[0].lower() != "bearer":
                return jsonify({"error": "invalid_authorization_header"}), 401

            payload = decode_token(parts[1])
            if isinstance(payload, dict) and payload.get("error"):
                return jsonify({"error": payload["error"]}), 401

            identity = payload.get("sub") or {}
            g.current_user = identity

            if roles:
                user_role = str(identity.get("role", "")).lower()
                if user_role not in roles:
                    return jsonify({"error": "forbidden"}), 403

            return fn(*args, **kwargs)

        return wrapper

    return decorator
