"""JWT validation against AWS Cognito.

Tokens are verified against the Cognito User Pool's JWKS (its public signing
keys), never trusted blindly. The current user is derived exclusively from
verified token claims (`sub`, `email`) - request bodies are never trusted for
identity, by design (see routes/recipes.py and routes/me.py).
"""

from functools import wraps

import jwt
from flask import g, jsonify, request

from . import config

_jwks_client = jwt.PyJWKClient(config.COGNITO_JWKS_URL) if config.USE_AUTH else None


class TokenValidationError(Exception):
    pass


def decode_cognito_token(token):
    if _jwks_client is None:
        raise TokenValidationError("Authentication is not configured on this server")

    signing_key = _jwks_client.get_signing_key_from_jwt(token)

    claims = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        issuer=config.COGNITO_ISSUER,
        options={"verify_aud": False},
    )

    token_use = claims.get("token_use")

    if token_use == "id":
        if claims.get("aud") != config.COGNITO_APP_CLIENT_ID:
            raise TokenValidationError("Token was not issued for this app client")
    elif token_use == "access":
        if claims.get("client_id") != config.COGNITO_APP_CLIENT_ID:
            raise TokenValidationError("Token was not issued for this app client")
    else:
        raise TokenValidationError("Unsupported token_use claim")

    if not claims.get("sub"):
        raise TokenValidationError("Token is missing the sub claim")

    return claims


def require_auth(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not config.USE_AUTH:
            return jsonify({"error": "Authentication is not configured on this server"}), 503

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing bearer token"}), 401

        token = auth_header[len("Bearer "):].strip()

        try:
            claims = decode_cognito_token(token)
        except (jwt.PyJWTError, TokenValidationError) as exc:
            return jsonify({"error": f"Invalid token: {exc}"}), 401

        email = claims.get("email") or claims.get("username")
        g.current_user = {"sub": claims["sub"], "email": email}

        return view(*args, **kwargs)

    return wrapped
