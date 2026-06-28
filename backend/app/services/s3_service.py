"""Private media S3 helpers — presigned URL generation only.

The EC2 instance IAM role provides credentials via instance metadata.
No credentials are stored in code or passed to the frontend.

Upload size is NOT enforced by S3 for presigned PUT URLs (ContentLengthRange
is a presigned POST feature). Callers must validate file size and type before
requesting a URL. Content-Type is locked into the PUT signature so S3 rejects
mismatches.
"""

import uuid

import boto3

from .. import config

_ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _client():
    return boto3.client("s3", region_name=config.AWS_REGION)


def safe_extension(filename):
    """Return a whitelisted lowercase extension or raise ValueError."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in _ALLOWED_EXTENSIONS:
        raise ValueError(f"File type .{ext} is not allowed")
    return ext


def generate_presigned_put_url(key, content_type, expires_in=900):
    """Return a presigned PUT URL valid for expires_in seconds (default 15 min).

    content_type is embedded in the signature — S3 rejects uploads that send
    a different Content-Type header.
    """
    if content_type not in _ALLOWED_CONTENT_TYPES:
        raise ValueError(f"Content type '{content_type}' is not allowed")
    return _client().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": config.APP_MEDIA_BUCKET_NAME,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )


def generate_presigned_get_url(key, expires_in=3600):
    """Return a presigned GET URL valid for expires_in seconds (default 1 hr).

    Returns None when key is falsy so callers can fall back to avatar_url /
    recipe.image safely.
    """
    if not key:
        return None
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": config.APP_MEDIA_BUCKET_NAME, "Key": key},
        ExpiresIn=expires_in,
    )


def make_recipe_image_key(owner_sub, recipe_id, filename):
    """Construct a deterministic private key for a recipe image."""
    ext = safe_extension(filename)
    return f"recipes/{owner_sub}/{recipe_id}/{uuid.uuid4()}.{ext}"


def make_avatar_key(owner_sub, filename):
    """Construct a deterministic private key for a user avatar."""
    ext = safe_extension(filename)
    return f"profiles/{owner_sub}/avatar/{uuid.uuid4()}.{ext}"
