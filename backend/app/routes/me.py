"""Current-user profile endpoints.

The identity (sub, email) comes exclusively from the verified JWT - never
from the request body. Profile fields (display name, username, bio, avatar)
live in our own database, auto-provisioned on first authenticated request.
"""

from flask import Blueprint, g, jsonify, request

from .. import config
from ..auth import require_auth
from ..db import get_session
from ..models import User

me_bp = Blueprint("me", __name__, url_prefix="/api/me")


def _serialize_user(user):
    return {
        "email": user.email,
        "displayName": user.display_name,
        "username": user.username,
        "bio": user.bio,
        "avatarUrl": user.avatar_url,
    }


def _get_or_create_user(session, claims):
    user = session.query(User).filter_by(cognito_sub=claims["sub"]).first()
    if user is None:
        handle = (claims.get("email") or "").split("@")[0] or "chef"
        user = User(
            cognito_sub=claims["sub"],
            email=claims.get("email") or "",
            display_name=handle.capitalize(),
            username=handle.lower(),
        )
        session.add(user)
        session.commit()
        session.refresh(user)
    return user


@me_bp.route("", methods=["GET"])
@require_auth
def get_me():
    if not config.USE_DB:
        return jsonify({"error": "Database is not configured"}), 503

    session = get_session()
    try:
        user = _get_or_create_user(session, g.current_user)
        return jsonify({"data": _serialize_user(user)})
    finally:
        session.close()


@me_bp.route("", methods=["PUT"])
@require_auth
def update_me():
    if not config.USE_DB:
        return jsonify({"error": "Database is not configured"}), 503

    payload = request.get_json(silent=True) or {}
    session = get_session()
    try:
        user = _get_or_create_user(session, g.current_user)

        if "displayName" in payload:
            user.display_name = (payload.get("displayName") or "").strip() or user.display_name
        if "username" in payload:
            user.username = (payload.get("username") or "").strip() or user.username
        if "bio" in payload:
            user.bio = payload.get("bio", "")
        if "avatarUrl" in payload:
            user.avatar_url = payload.get("avatarUrl", "")

        session.commit()
        session.refresh(user)
        return jsonify({"data": _serialize_user(user)})
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
