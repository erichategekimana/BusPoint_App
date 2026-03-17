from flask import Blueprint, jsonify, g
from ..database import db
from ..models import User
from ..schemas import UserRegistrationSchema, UserLoginSchema
from ..utils import validate_json, db_commit_or_rollback
from ..auth import hash_password, verify_password, create_access_token, jwt_required


# create the blueprint
auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/register', methods=['POST'])
@validate_json(UserRegistrationSchema)
@db_commit_or_rollback
def register_user(validated_data: UserRegistrationSchema):
    # check if user with the same phone number exists
    existing_user = User.query.filter_by(phone_number=validated_data.phone_number).first()
    if existing_user:
        return jsonify({"error": "Phone number already registered"}), 400
    
    if validated_data.email:
        existing_email = User.query.filter_by(email=validated_data.email).first()
        if existing_email:
            return jsonify({"error": "Email already registered"}), 400
        
    # hash the password
    hashed_pw = hash_password(validated_data.password)

    # create new user
    new_user = User(
        fullname=validated_data.fullname,
        phone_number=validated_data.phone_number,
        email=validated_data.email,
        password_hash=hashed_pw
    )

    # Add to session and commit(db_commit_or_rollback will handle commit/rollback)
    db.session.add(new_user)
    # flush the session to get the new user's ID for token creation
    db.session.flush()
    # create access token
    token = create_access_token({"id": str(new_user.id), "role": new_user.role})
    return jsonify({
        "message": "user registered successfully",
        "user": new_user.to_dict(),
        "access_token": token
    }), 201



# Login route
@auth_bp.route('/login', methods=['POST'])
@validate_json(UserLoginSchema)
def login_user(validated_data: UserLoginSchema):
    # autheenticate a user and retuns a JWT token if successful

    # find user by phone number
    user = User.query.filter_by(phone_number=validated_data.phone_number).first()

    # if user not found or password does not match
    if not user or not verify_password(user.password_hash, validated_data.password):
        return jsonify({"error": "unauthorized", "message": "Invalid phone number or password"}), 401

    # create access token
    token = create_access_token({"id": str(user.id), "role": user.role})
    return jsonify({
        "message": "login successful",
        "user": user.to_dict(),
        "access_token": token
    }), 200



""" returns the profile of the currently logged-in user."""
@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():

    # g.current_user is set by the jwt_required decorator after validating the token
    user_identity = g.current_user
    user = User.query.get(user_identity['id'])

    if not user:
        return jsonify({"error": "user not found"}), 404
    
    return jsonify({"user": user.to_dict()}), 200