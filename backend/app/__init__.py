from flask import Flask
from flask_cors import CORS

from . import config
from .db import init_db
from .routes.ai import ai_bp
from .routes.ai_conversations import ai_conversations_bp, ai_memory_bp
from .routes.health import health_bp
from .routes.me import me_bp
from .routes.recipes import recipes_bp


def create_app():
    app = Flask(__name__)

    cors_kwargs = {"allow_headers": ["Content-Type", "Authorization"]}
    if config.CORS_ALLOWED_ORIGINS:
        CORS(app, origins=config.CORS_ALLOWED_ORIGINS, **cors_kwargs)
    else:
        CORS(app, **cors_kwargs)

    app.register_blueprint(health_bp)
    app.register_blueprint(recipes_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(ai_conversations_bp)
    app.register_blueprint(ai_memory_bp)
    app.register_blueprint(me_bp)

    if config.USE_DB:
        init_db()

    return app
