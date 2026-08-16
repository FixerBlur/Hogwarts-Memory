"""Pensieve web app — Flask application factory."""
import os
import secrets
from pathlib import Path

from flask import Flask, send_file

from . import db
from .routes import api

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def _persistent_secret(path: Path, generate) -> str:
    """Read a secret from `path`, creating it on first run. On a read-only
    filesystem (serverless) falls back to an ephemeral value — set the
    corresponding environment variable there instead."""
    try:
        if path.exists():
            return path.read_text(encoding="utf-8").strip()
        value = generate()
        path.write_text(value + "\n", encoding="utf-8")
        return value
    except OSError:
        return generate()


def create_app() -> Flask:
    app = Flask(
        __name__,
        static_folder=str(ROOT / "public"),
        static_url_path="",
    )
    try:
        DATA.mkdir(exist_ok=True)
    except OSError:
        pass  # read-only filesystem (serverless): SQLite/data files unused there
    app.config["DATABASE"] = str(DATA / "pensieve.db")
    # env first (production), data/ files as the local fallback
    app.secret_key = os.environ.get("SECRET_KEY") or _persistent_secret(
        DATA / "secret_key.txt", lambda: secrets.token_hex(32))
    app.config["ADMIN_PASSWORD"] = os.environ.get("ADMIN_PASSWORD") or _persistent_secret(
        DATA / "admin_password.txt", lambda: secrets.token_urlsafe(9))
    if os.environ.get("VERCEL"):
        app.config["SESSION_COOKIE_SECURE"] = True

    db.init_app(app)
    app.register_blueprint(api, url_prefix="/api")

    @app.route("/")
    def index():
        return app.send_static_file("index.html")

    # admin.html lives outside public/ on purpose: the static folder is served
    # whole, and the panel should only exist at this address
    @app.route("/adminer")
    def admin():
        return send_file(ROOT / "admin.html")

    return app
