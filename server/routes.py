"""JSON API for memories."""
import hmac
from functools import wraps
from time import sleep

from flask import Blueprint, current_app, jsonify, request, session

from . import db

api = Blueprint("api", __name__)

MAX_AUTHOR = 60
MAX_TITLE = 120
MAX_BODY = 5000

DEFAULT_AUTHOR = "Невідомий чарівник"


def serialize(row) -> dict:
    created = row["created_at"]
    if not isinstance(created, str):  # Postgres returns datetime, SQLite a string
        created = created.strftime("%Y-%m-%d %H:%M:%S")
    return {
        "id": row["id"],
        "author": row["author"],
        "title": row["title"],
        "body": row["body"],
        "created_at": created,
    }


@api.post("/memories")
def create_memory():
    data = request.get_json(silent=True) or {}
    author = (data.get("author") or "").strip() or DEFAULT_AUTHOR
    title = (data.get("title") or "").strip()
    body = (data.get("body") or "").strip()

    if not title or not body:
        return jsonify(error="Потрібні і назва, і сам спогад.", code="missing_fields"), 400
    if len(author) > MAX_AUTHOR or len(title) > MAX_TITLE or len(body) > MAX_BODY:
        return jsonify(error="Спогад задовгий для чаші.", code="too_long"), 400

    memory_id = db.add_memory(author, title, body)
    return jsonify(id=memory_id, total=db.count_memories()), 201


@api.get("/memories/random")
def get_random_memory():
    exclude = request.args.get("exclude", type=int)
    row = db.random_memory(exclude_id=exclude)
    if row is None:
        return jsonify(error="Омут порожній — ще ніхто не залишив спогадів.", code="empty"), 404
    return jsonify(serialize(row))


@api.get("/memories/count")
def get_count():
    return jsonify(total=db.count_memories())


@api.get("/geo")
def geo():
    """Visitor's country code, courtesy of Vercel's edge (null locally)."""
    return jsonify(country=request.headers.get("X-Vercel-IP-Country"))


def require_admin(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("admin"):
            return jsonify(error="Потрібен вхід в адмінку.", code="unauthorized"), 401
        return fn(*args, **kwargs)
    return wrapper


@api.post("/admin/login")
def admin_login():
    data = request.get_json(silent=True) or {}
    supplied = str(data.get("password") or "")
    if not hmac.compare_digest(supplied, current_app.config["ADMIN_PASSWORD"]):
        sleep(0.5)  # slow down brute force
        return jsonify(error="Невірний пароль.", code="bad_password"), 401
    session["admin"] = True
    return jsonify(ok=True)


@api.post("/admin/logout")
def admin_logout():
    session.pop("admin", None)
    return jsonify(ok=True)


@api.get("/admin/memories")
@require_admin
def admin_list_memories():
    return jsonify([serialize(row) for row in db.list_memories()])


@api.delete("/admin/memories/<int:memory_id>")
@require_admin
def admin_delete_memory(memory_id: int):
    if not db.delete_memory(memory_id):
        return jsonify(error="Немає такого спогаду.", code="not_found"), 404
    return jsonify(ok=True, total=db.count_memories())
