"""Centralized runtime configuration.

All configuration comes from environment variables so that, in Kubernetes,
values can be injected via ConfigMaps and Secrets without any code changes.
"""

import os

DATABASE_URL = os.environ.get("DATABASE_URL")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
PORT = int(os.environ.get("PORT", "8080"))
FLASK_ENV = os.environ.get("FLASK_ENV", "production")

# Convenience flags used to switch between mock data and real integrations.
USE_DB = bool(DATABASE_URL)
USE_OPENAI = bool(OPENAI_API_KEY)


CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
COGNITO_USER_POOL_ID = os.environ.get("COGNITO_USER_POOL_ID")
COGNITO_APP_CLIENT_ID = os.environ.get("COGNITO_APP_CLIENT_ID")

USE_AUTH = bool(COGNITO_USER_POOL_ID and COGNITO_APP_CLIENT_ID)

COGNITO_ISSUER = (
    f"https://cognito-idp.{AWS_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"
    if USE_AUTH
    else None
)
COGNITO_JWKS_URL = f"{COGNITO_ISSUER}/.well-known/jwks.json" if USE_AUTH else None
