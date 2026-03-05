import jwt
from datetime import datetime, timedelta
from flask import current_app, request, jsonify, g
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash

def hash_password(plain):
    return generate_password_hash(plain)

def verify_password(hash, plain):
    return check_password_hash(hash, plain)

def create_access_token(identity: dict):
    secret = current_app.config["JWT_SECRET"]
    algo = current_app.config["JWT_ALGORITHM"]
    exp = datetime.utcnow() + current_app.config["JWT_ACCESS_TOKEN_EXPIRES"]
    payload = {
        "sub": identity,
        "exp": exp,
        "iat": datetime.utcnow()
    }
    token = jwt.encode(payload, secret, algorithm=algo)
    # PyJWT returns str in newer versions; ensure string type
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token

def decode_token(token):
    secret = current_app.config["JWT_SECRET"]
    algo = current_app.config["JWT_ALGORITHM"]
    try:
        payload = jwt.decode(token, secret, algorithms=[algo])
        return payload
    except jwt.ExpiredSignatureError:
        return {"error": "token_expired"}
    except jwt.InvalidTokenError:
        return {"error": "invalid_token"}

def jwt_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", None)
        if not auth:
            return jsonify({"error": "authorization_header_missing"}), 401

        parts = auth.split()
        if parts[0].lower() != "bearer" or len(parts) != 2:
            return jsonify({"error": "invalid_authorization_header"}), 401

        token = parts[1]
        data = decode_token(token)
        if isinstance(data, dict) and data.get("error"):
            return jsonify({"error": data["error"]}), 401

        # set user identity in flask.g for route use
        g.current_user = data.get("sub")
        return fn(*args, **kwargs)
    return wrapper
