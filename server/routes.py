"""JSON API for memories."""
import hmac
import threading
import time
from functools import wraps

from flask import Blueprint, current_app, jsonify, request, session

from . import db
from .translate import translate

api = Blueprint("api", __name__)

MAX_AUTHOR = 60
MAX_TITLE = 120
MAX_BODY = 5000

DEFAULT_AUTHOR = "Невідомий чарівник"

# Per-IP cap on new memories. In-process only, so on serverless it holds
# per warm instance; still enough to stop a naive flood.
RATE_LIMIT = 5        # memories
RATE_WINDOW = 10 * 60  # seconds
_recent: dict[str, list[float]] = {}
_recent_lock = threading.Lock()


def client_ip() -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    return forwarded.split(",")[0].strip() or request.remote_addr or "?"


def _fresh(stamps: list[float], now: float) -> list[float]:
    return [t for t in stamps if now - t < RATE_WINDOW]


def rate_limited(ip: str) -> bool:
    now = time.time()
    with _recent_lock:
        stamps = _recent[ip] = _fresh(_recent.get(ip, []), now)
        if len(_recent) > 2000:  # keep the table small
            for key in [k for k, v in _recent.items() if not _fresh(v, now)]:
                del _recent[key]
        return len(stamps) >= RATE_LIMIT


def record_write(ip: str):
    with _recent_lock:
        _recent.setdefault(ip, []).append(time.time())


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
    ip = client_ip()
    if rate_limited(ip):
        return jsonify(error="Забагато спогадів поспіль — зачекай трохи.", code="rate_limited"), 429

    memory_id = db.add_memory(author, title, body)
    record_write(ip)
    return jsonify(id=memory_id, total=db.count_memories()), 201


def localized(row, lang: str) -> dict:
    """The memory as stored, or its English translation for English UI.
    Each memory is translated once and cached in the translations table."""
    payload = serialize(row)
    if lang != "en":
        return payload
    cached = db.get_translation(row["id"], "en")
    if cached is None:
        result = translate([row["title"], row["body"]], "EN-GB")
        if result is None:  # translation service down — serve the original
            return payload
        db.save_translation(row["id"], "en", result[0], result[1])
        cached = {"title": result[0], "body": result[1]}
    payload.update(title=cached["title"], body=cached["body"], translated=True)
    return payload


@api.get("/memories/random")
def get_random_memory():
    exclude = request.args.get("exclude", type=int)
    lang = request.args.get("lang", "uk")
    row = db.random_memory(exclude_id=exclude)
    if row is None:
        return jsonify(error="Омут порожній — ще ніхто не залишив спогадів.", code="empty"), 404
    return jsonify(localized(row, lang))


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
        time.sleep(0.5)  # slow down brute force
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
