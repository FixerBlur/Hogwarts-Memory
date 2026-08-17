"""Storage for memories.

Local runs use the bundled SQLite file. In production (Vercel) the
filesystem is read-only, so when DATABASE_URL is set the same five
operations run against Postgres instead.
"""
import os
import sqlite3

from flask import Flask, current_app, g

DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    import psycopg
    from psycopg.rows import dict_row

# placeholder style differs between the two drivers
_P = "%s" if DATABASE_URL else "?"

SCHEMA_SQLITE = [
    """
CREATE TABLE IF NOT EXISTS memories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    author     TEXT NOT NULL DEFAULT 'Невідомий чарівник',
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
""",
    """
CREATE TABLE IF NOT EXISTS translations (
    memory_id INTEGER NOT NULL,
    lang      TEXT NOT NULL,
    title     TEXT NOT NULL,
    body      TEXT NOT NULL,
    PRIMARY KEY (memory_id, lang)
);
""",
]

SCHEMA_PG = [
    """
CREATE TABLE IF NOT EXISTS memories (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    author     TEXT NOT NULL DEFAULT 'Невідомий чарівник',
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
""",
    """
CREATE TABLE IF NOT EXISTS translations (
    memory_id BIGINT NOT NULL,
    lang      TEXT NOT NULL,
    title     TEXT NOT NULL,
    body      TEXT NOT NULL,
    PRIMARY KEY (memory_id, lang)
);
""",
]


def get_db():
    if "db" not in g:
        if DATABASE_URL:
            g.db = psycopg.connect(DATABASE_URL, row_factory=dict_row)
        else:
            conn = sqlite3.connect(current_app.config["DATABASE"])
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")
            g.db = conn
    return g.db


def close_db(_exc=None):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def init_app(app: Flask):
    app.teardown_appcontext(close_db)
    if DATABASE_URL:
        with psycopg.connect(DATABASE_URL) as conn:
            for statement in SCHEMA_PG:
                conn.execute(statement)
            conn.commit()
    else:
        with app.app_context():
            conn = sqlite3.connect(app.config["DATABASE"])
            for statement in SCHEMA_SQLITE:
                conn.execute(statement)
            conn.commit()
            conn.close()


def add_memory(author: str, title: str, body: str) -> int:
    conn = get_db()
    if DATABASE_URL:
        cur = conn.execute(
            f"INSERT INTO memories (author, title, body) VALUES ({_P}, {_P}, {_P}) RETURNING id",
            (author, title, body),
        )
        new_id = cur.fetchone()["id"]
    else:
        cur = conn.execute(
            f"INSERT INTO memories (author, title, body) VALUES ({_P}, {_P}, {_P})",
            (author, title, body),
        )
        new_id = cur.lastrowid
    conn.commit()
    return new_id


def random_memory(exclude_id: int | None = None):
    conn = get_db()
    if exclude_id is not None:
        row = conn.execute(
            f"SELECT * FROM memories WHERE id != {_P} ORDER BY RANDOM() LIMIT 1",
            (exclude_id,),
        ).fetchone()
        if row is not None:
            return row
    return conn.execute(
        "SELECT * FROM memories ORDER BY RANDOM() LIMIT 1"
    ).fetchone()


def count_memories() -> int:
    return get_db().execute("SELECT COUNT(*) AS n FROM memories").fetchone()["n"]


def list_memories():
    return get_db().execute(
        "SELECT * FROM memories ORDER BY id DESC"
    ).fetchall()


def delete_memory(memory_id: int) -> bool:
    conn = get_db()
    conn.execute(f"DELETE FROM translations WHERE memory_id = {_P}", (memory_id,))
    cur = conn.execute(f"DELETE FROM memories WHERE id = {_P}", (memory_id,))
    conn.commit()
    return cur.rowcount > 0


def get_translation(memory_id: int, lang: str):
    return get_db().execute(
        f"SELECT title, body FROM translations WHERE memory_id = {_P} AND lang = {_P}",
        (memory_id, lang),
    ).fetchone()


def save_translation(memory_id: int, lang: str, title: str, body: str):
    conn = get_db()
    conn.execute(
        f"INSERT INTO translations (memory_id, lang, title, body) "
        f"VALUES ({_P}, {_P}, {_P}, {_P}) ON CONFLICT DO NOTHING",
        (memory_id, lang, title, body),
    )
    conn.commit()
