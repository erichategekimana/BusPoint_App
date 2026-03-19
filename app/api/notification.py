from __future__ import annotations

from uuid import UUID

from flask import Blueprint, g, jsonify, request
from pydantic import BaseModel, Field, ValidationError

from app.auth import jwt_required, role_required
from app.database import db
from app.models import Notification, User


notification_bp = Blueprint("notification_api", __name__, url_prefix="/api")


class NotificationCreateRequest(BaseModel):
    user_id: UUID
    title: str = Field(min_length=1, max_length=255)
    message: str = Field(min_length=1)
    type: str | None = Field(default=None, max_length=50)
    is_ready: bool | None = None


class NotificationUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    message: str | None = Field(default=None, min_length=1)
    type: str | None = Field(default=None, max_length=50)
    is_ready: bool | None = None


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


def parse_bool(raw: str | None) -> bool | None:
    if raw is None:
        return None
    return raw.strip().lower() in {"1", "true", "yes"}


def notification_to_dict(notification: Notification) -> dict:
    return {
        "id": str(notification.id),
        "user_id": str(notification.user_id),
        "title": notification.title,
        "message": notification.message,
        "type": notification.type,
        "is_ready": notification.is_ready,
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
    }


# ── READ endpoints ──────────────────────────────────────────────────────────
# Admin sees all; users see only their own.

@notification_bp.get("/notifications")
@jwt_required()
def list_notifications():
    current_user = g.current_user or {}
    role = current_user.get("role")
    is_ready = parse_bool(request.args.get("is_ready"))

    query = Notification.query

    if role == "admin":
        user_id_filter = request.args.get("user_id")
        if user_id_filter:
            user_uuid, error = parse_uuid(user_id_filter, "user_id")
            if error:
                return error
            query = query.filter(Notification.user_id == user_uuid)
    else:
        own_uuid = UUID(current_user.get("user_id"))
        query = query.filter(Notification.user_id == own_uuid)

    if is_ready is not None:
        query = query.filter(Notification.is_ready == is_ready)

    notifications = query.order_by(Notification.created_at.desc()).all()
    return jsonify([notification_to_dict(n) for n in notifications]), 200


@notification_bp.get("/notifications/<notification_id>")
@jwt_required()
def get_notification(notification_id: str):
    current_user = g.current_user or {}
    notification_uuid, error = parse_uuid(notification_id, "notification_id")
    if error:
        return error
    notification = db.session.get(Notification, notification_uuid)
    if not notification:
        return jsonify({"error": "notification_not_found"}), 404
    if current_user.get("role") != "admin" and str(notification.user_id) != current_user.get("user_id"):
        return jsonify({"error": "forbidden"}), 403
    return jsonify(notification_to_dict(notification)), 200


# ── WRITE endpoints ─────────────────────────────────────────────────────────

@notification_bp.post("/notifications")
@jwt_required()
@role_required("admin")
def create_notification():
    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(NotificationCreateRequest, payload)
    if error:
        return error

    if not db.session.get(User, validated.user_id):
        return jsonify({"error": "user_not_found"}), 404

    notification = Notification(
        user_id=validated.user_id,
        title=validated.title.strip(),
        message=validated.message.strip(),
    )
    if validated.type is not None:
        notification.type = validated.type
    if validated.is_ready is not None:
        notification.is_ready = validated.is_ready

    db.session.add(notification)
    db.session.commit()
    return jsonify(notification_to_dict(notification)), 201


@notification_bp.patch("/notifications/<notification_id>")
@jwt_required()
def update_notification(notification_id: str):
    current_user = g.current_user or {}
    notification_uuid, error = parse_uuid(notification_id, "notification_id")
    if error:
        return error
    notification = db.session.get(Notification, notification_uuid)
    if not notification:
        return jsonify({"error": "notification_not_found"}), 404

    # Admin can edit anything; users can only mark their own notifications as read
    if current_user.get("role") != "admin" and str(notification.user_id) != current_user.get("user_id"):
        return jsonify({"error": "forbidden"}), 403

    payload = request.get_json(silent=True) or {}
    validated, error = validate_payload(NotificationUpdateRequest, payload)
    if error:
        return error

    if current_user.get("role") == "admin":
        if validated.title is not None:
            notification.title = validated.title.strip()
        if validated.message is not None:
            notification.message = validated.message.strip()
        if validated.type is not None:
            notification.type = validated.type

    # Any authenticated owner (or admin) may toggle is_ready
    if validated.is_ready is not None:
        notification.is_ready = validated.is_ready

    db.session.commit()
    return jsonify(notification_to_dict(notification)), 200


@notification_bp.delete("/notifications/<notification_id>")
@jwt_required()
@role_required("admin")
def delete_notification(notification_id: str):
    notification_uuid, error = parse_uuid(notification_id, "notification_id")
    if error:
        return error
    notification = db.session.get(Notification, notification_uuid)
    if not notification:
        return jsonify({"error": "notification_not_found"}), 404
    db.session.delete(notification)
    db.session.commit()
    return jsonify({"status": "deleted"}), 200
