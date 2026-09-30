"""SQLite storage."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  thread_id TEXT,
  source_id TEXT,
  received_at DATETIME,
  sender_name TEXT,
  sender_email TEXT,
  subject TEXT,
  body_clean TEXT,
  attachment_text TEXT,
  gmail_link TEXT,
  processed_at DATETIME,
  body_hash TEXT,
  skip_reason TEXT,
  fetched_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_emails_source_received ON emails(source_id, received_at);
CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id);

CREATE TABLE IF NOT EXISTS classifications (
  email_id TEXT PRIMARY KEY REFERENCES emails(id),
  category TEXT,
  project_ids TEXT,
  importance INTEGER,
  needs_action BOOLEAN,
  action_summary TEXT,
  action_due DATE,
  dates_mentioned TEXT,
  people_mentioned TEXT,
  one_line TEXT,
  model TEXT,
  created_at DATETIME
);

CREATE TABLE IF NOT EXISTS editions (
  id INTEGER PRIMARY KEY,
  source_id TEXT,
  number INTEGER,
  period_start DATE,
  period_end DATE,
  published_at DATETIME,
  html_path TEXT
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY,
  edition_id INTEGER REFERENCES editions(id),
  section TEXT,
  kind TEXT,
  project_id TEXT,
  headline TEXT,
  standfirst TEXT,
  body_html TEXT,
  what_it_means TEXT,
  source_email_ids TEXT,
  rank INTEGER
);

CREATE TABLE IF NOT EXISTS sync_state (
  source_id TEXT PRIMARY KEY,
  last_fetch_at DATETIME
);
"""


def connect(path: Path | None = None) -> sqlite3.Connection:
    config.ensure_dirs()
    conn = sqlite3.connect(path or config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    return conn


def row_to_dict(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    d = dict(row)
    for key in ("project_ids", "dates_mentioned", "people_mentioned", "source_email_ids"):
        if key in d and isinstance(d[key], str):
            try:
                d[key] = json.loads(d[key])
            except json.JSONDecodeError:
                d[key] = []
    if "needs_action" in d and d["needs_action"] is not None:
        d["needs_action"] = bool(d["needs_action"])
    return d


def get_last_fetch(conn, source_id: str) -> str | None:
    r = conn.execute("SELECT last_fetch_at FROM sync_state WHERE source_id=?", (source_id,)).fetchone()
    return r["last_fetch_at"] if r else None


def set_last_fetch(conn, source_id: str, when: str) -> None:
    conn.execute(
        "INSERT INTO sync_state(source_id, last_fetch_at) VALUES(?, ?) "
        "ON CONFLICT(source_id) DO UPDATE SET last_fetch_at=excluded.last_fetch_at",
        (source_id, when),
    )
