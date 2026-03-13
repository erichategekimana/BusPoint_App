from __future__ import annotations

from uuid import UUID

from flask import Blueprint, g, jsonify, request
from pydantic import BaseModel, EmailStr, Field, ValidationError

from app.auth import create_access_token, hash_password, jwt_required, verify_password
from app.database import db
from app.models import User


user_bp = Blueprint("user_api", __name__, url_prefix="/api")


def parse_uuid(raw_value: str, field_name: str):
    try:
        return UUID(raw_value), None
    except ValueError:
        return None, (jsonify({"error": f"invalid_{field_name}"}), 400)


def model_errors(errors: list[dict]) -> tuple:
    return jsonify({"error": "validation_error", "details": errors}), 400


def validate_payload(schema, payload: dict):
    try:
        return schema.model_validate(payload), None
    except ValidationError as exc:
        return None, model_errors(exc.errors())


class UserCreateRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    phone_number: str = Field(min_length=7, max_length=15)
    email: EmailStr | None = None
    password: str = Field(min_length=6, max_length=128)
    role: str = Field(default="passenger")


class UserUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=100)
    phone_number: str | None = Field(default=None, min_length=7, max_length=15)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)
    role: str | None = None


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    phone_number: str = Field(min_length=7, max_length=15)
    email: EmailStr | None = None
    password: str = Field(min_length=6, max_length=128)
    role: str = Field(default="passenger")


class LoginRequest(BaseModel):
    phone_number: str | None = None
    email: EmailStr | None = None
    password: str = Field(min_length=6, max_length=128)


class AuthUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=100)
    phone_number: str | None = Field(default=None, min_length=7, max_length=15)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)


@user_bp.post("/auth/register")
def register():
    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(RegisterRequest, payload)
    if error:
        return error

    if User.query.filter_by(phone_number=validated.phone_number).first():
        return jsonify({"error": "phone_number_already_exists"}), 409
    if validated.email and User.query.filter_by(email=str(validated.email)).first():
        return jsonify({"error": "email_already_exists"}), 409

    user = User(
        full_name=validated.full_name.strip(),
        phone_number=validated.phone_number.strip(),
        email=str(validated.email) if validated.email else None,
        password_hash=hash_password(validated.password),
        role=validated.role or "passenger",
    )
    db.session.add(user)
    db.session.commit()

    token = create_access_token({"user_id": str(user.id), "role": user.role})
    return jsonify({"user": user.to_dict(), "access_token": token}), 201


@user_bp.post("/auth/login")
def login():
    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(LoginRequest, payload)
    if error:
        return error

    user = None
    if validated.phone_number:
        user = User.query.filter_by(phone_number=validated.phone_number).first()
    elif validated.email:
        user = User.query.filter_by(email=str(validated.email)).first()
    else:
        return jsonify({"error": "phone_number_or_email_required"}), 400

    if not user or not verify_password(user.password_hash, validated.password):
        return jsonify({"error": "invalid_credentials"}), 401

    token = create_access_token({"user_id": str(user.id), "role": user.role})
    return jsonify({"user": user.to_dict(), "access_token": token}), 200


@user_bp.patch("/auth/update")
@jwt_required()
def update_me():
    current_user = g.current_user or {}
    user_id = current_user.get("user_id")
    if not user_id:
        return jsonify({"error": "invalid_token_payload"}), 401

    user_uuid, error = parse_uuid(user_id, "user_id")
    if error:
        return error
    user = db.session.get(User, user_uuid)
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(AuthUpdateRequest, payload)
    if error:
        return error

    if validated.phone_number and validated.phone_number != user.phone_number:
        existing = User.query.filter(User.phone_number == validated.phone_number, User.id != user.id).first()
        if existing:
            return jsonify({"error": "phone_number_already_exists"}), 409

    if validated.email and validated.email != user.email:
        existing = User.query.filter(User.email == str(validated.email), User.id != user.id).first()
        if existing:
            return jsonify({"error": "email_already_exists"}), 409

    if validated.full_name is not None:
        user.full_name = validated.full_name.strip()
    if validated.phone_number is not None:
        user.phone_number = validated.phone_number.strip()
    if validated.email is not None:
        user.email = str(validated.email)
    if validated.password is not None:
        user.password_hash = hash_password(validated.password)

    db.session.commit()
    return jsonify(user.to_dict()), 200


@user_bp.get("/users")
def list_users():
    role = request.args.get("role")
    query = User.query
    if role:
        query = query.filter(User.role == role)
    users = query.order_by(User.created_at.desc()).all()
    return jsonify([user.to_dict() for user in users]), 200


@user_bp.get("/users/<user_id>")
def get_user(user_id: str):
    user_uuid, error = parse_uuid(user_id, "user_id")
    if error:
        return error
    user = db.session.get(User, user_uuid)
    if not user:
        return jsonify({"error": "user_not_found"}), 404
    return jsonify(user.to_dict()), 200


@user_bp.post("/users")
def create_user():
    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(UserCreateRequest, payload)
    if error:
        return error

    if User.query.filter_by(phone_number=validated.phone_number).first():
        return jsonify({"error": "phone_number_already_exists"}), 409
    if validated.email and User.query.filter_by(email=str(validated.email)).first():
        return jsonify({"error": "email_already_exists"}), 409

    user = User(
        full_name=validated.full_name.strip(),
        phone_number=validated.phone_number.strip(),
        email=str(validated.email) if validated.email else None,
        password_hash=hash_password(validated.password),
        role=validated.role or "passenger",
    )
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201


@user_bp.patch("/users/<user_id>")
def update_user(user_id: str):
    user_uuid, error = parse_uuid(user_id, "user_id")
    if error:
        return error
    user = db.session.get(User, user_uuid)
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(UserUpdateRequest, payload)
    if error:
        return error

    if validated.phone_number and validated.phone_number != user.phone_number:
        existing = User.query.filter(User.phone_number == validated.phone_number, User.id != user.id).first()
        if existing:
            return jsonify({"error": "phone_number_already_exists"}), 409

    if validated.email and validated.email != user.email:
        existing = User.query.filter(User.email == str(validated.email), User.id != user.id).first()
        if existing:
            return jsonify({"error": "email_already_exists"}), 409

    if validated.full_name is not None:
        user.full_name = validated.full_name.strip()
    if validated.phone_number is not None:
        user.phone_number = validated.phone_number.strip()
    if validated.email is not None:
        user.email = str(validated.email)
    if validated.password is not None:
        user.password_hash = hash_password(validated.password)
    if validated.role is not None:
        user.role = validated.role

    db.session.commit()
    return jsonify(user.to_dict()), 200


@user_bp.delete("/users/<user_id>")
def delete_user(user_id: str):
    user_uuid, error = parse_uuid(user_id, "user_id")
    if error:
        return error
    user = db.session.get(User, user_uuid)
    if not user:
        return jsonify({"error": "user_not_found"}), 404
    db.session.delete(user)
    db.session.commit()
    return jsonify({"status": "deleted"}), 200
