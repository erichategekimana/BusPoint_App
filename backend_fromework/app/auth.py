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
        "identity": identity,
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
        print(f"DEBUG decode_token success: {payload}")
        return payload
    except jwt.ExpiredSignatureError:
        print("DEBUG decode_token: token_expired") 
        return {"error": "token_expired"}
    except jwt.InvalidTokenError as e:
        print(f"DEBUG decode_token: invalid_token - {e}") 
        return {"error": "invalid_token"}

def jwt_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", None)
        print(f"DEBUG Authorization header: {auth}") 
        if not auth:
            return jsonify({"error": "authorization_header_missing"}), 401

        parts = auth.split()
        print(f"DEBUG Authorization parts: {parts}") 
        if parts[0].lower() != "bearer" or len(parts) != 2:
            return jsonify({"error": "invalid_authorization_header"}), 401

        token = parts[1]
        data = decode_token(token)
        print(f"DEBUG decode_token returned: {data}") 
        if isinstance(data, dict) and data.get("error"):
            return jsonify({"error": data["error"]}), 401

        # set user identity in flask.g for route use
        g.current_user = data.get("identity")
        return fn(*args, **kwargs)
    return wrapper



def roles_required(*roles):
    """
    Decorator to restrict access to specific roles.
    Usage: @roles_required('admin', 'driver')
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # g.current_user is populated by @jwt_required
            user_role = g.current_user.get('role')

            if user_role not in roles:
                return jsonify({
                    "error": "forbidden", 
                    "message": f"Access denied. Required roles: {', '.join(roles)}"
                }), 403
            
            return fn(*args, **kwargs)
        return wrapper
    return decorator
