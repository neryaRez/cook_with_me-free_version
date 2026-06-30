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
from ..services import s3_service

me_bp = Blueprint("me", __name__, url_prefix="/api/me")

_AVATAR_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
_AVATAR_MAX_BYTES = 5 * 1024 * 1024  # 5 MB


def _serialize_user(user):
    avatar_url = None
    if user.avatar_key and config.USE_PRIVATE_MEDIA:
        avatar_url = s3_service.generate_presigned_get_url(user.avatar_key)
    elif user.avatar_url:
        avatar_url = user.avatar_url
    return {
        "email": user.email,
        "displayName": user.display_name,
        "username": user.username,
        "bio": user.bio,
        "avatarUrl": avatar_url,
        "avatarKey": user.avatar_key,
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
        if "avatarKey" in payload:
            avatar_key = (payload.get("avatarKey") or "").strip()
            if avatar_key:
                expected_prefix = f"profiles/{g.current_user['sub']}/avatar/"
                if not avatar_key.startswith(expected_prefix):
                    return jsonify({"error": "avatarKey does not belong to the authenticated user"}), 403
            user.avatar_key = avatar_key or None
            if avatar_key:
                user.avatar_url = None

        session.commit()
        session.refresh(user)
        return jsonify({"data": _serialize_user(user)})
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@me_bp.route("/avatar/upload-url", methods=["POST"])
@require_auth
def avatar_upload_url():
    if not config.USE_PRIVATE_MEDIA:
        return jsonify({"error": "Media storage is not configured"}), 503

    payload = request.get_json(silent=True) or {}
    content_type = (payload.get("contentType") or "").strip()
    file_size = payload.get("fileSize")

    if content_type not in _AVATAR_ALLOWED_TYPES:
        return jsonify({"error": "File type not allowed. Use image/jpeg, image/png, or image/webp."}), 400

    try:
        file_size = int(file_size)
    except (TypeError, ValueError):
        return jsonify({"error": "fileSize must be a positive integer."}), 400
    if file_size <= 0 or file_size > _AVATAR_MAX_BYTES:
        return jsonify({"error": "File too large. Maximum size is 5 MB."}), 400

    owner_sub = g.current_user["sub"]
    key = s3_service.make_avatar_key_from_content_type(owner_sub, content_type)
    upload_url = s3_service.generate_presigned_put_url(key, content_type)

    return jsonify({
        "data": {
            "uploadUrl": upload_url,
            "avatarKey": key,
            "headers": {"Content-Type": content_type},
        }
    })
