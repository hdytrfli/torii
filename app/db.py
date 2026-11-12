from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

JOB_FIELDS = {
    "source_size",
    "source_mtime",
    "status",
    "media_type",
    "title",
    "year",
    "season",
    "episode",
    "confidence",
    "reason",
    "parsed_json",
    "candidates_json",
    "llm_json",
    "target_path",
    "error",
    "updated_at",
}

SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_path TEXT NOT NULL UNIQUE,
    source_size INTEGER NOT NULL,
    source_mtime REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'analyzing',
    media_type TEXT,
    title TEXT,
    year INTEGER,
    season INTEGER,
    episode INTEGER,
    confidence REAL NOT NULL DEFAULT 0,
    reason TEXT,
    parsed_json TEXT,
    candidates_json TEXT,
    llm_json TEXT,
    target_path TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _bool(value: str | None) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


class DB:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._init()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=5000")
        return conn

    def _init(self) -> None:
        with self._connect() as conn:
            conn.executescript(SCHEMA)

    # settings ---------------------------------------------------------

    def ensure_settings(self, defaults: dict[str, str]) -> None:
        with self._connect() as conn:
            for key, value in defaults.items():
                conn.execute(
                    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                    (key, value),
                )

    def settings(self) -> dict[str, str]:
        with self._connect() as conn:
            rows = conn.execute("SELECT key, value FROM settings").fetchall()
        return {row["key"]: row["value"] for row in rows}

    def set_settings(self, values: dict[str, str]) -> None:
        with self._connect() as conn:
            conn.executemany(
                "INSERT INTO settings (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                list(values.items()),
            )

    # jobs -------------------------------------------------------------

    def get_job(self, job_id: int) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return dict(row) if row else None

    def get_job_by_source(self, source: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM jobs WHERE source_path = ?", (source,)
            ).fetchone()
        return dict(row) if row else None

    def list_jobs(self, status: str | None = None, limit: int = 200) -> list[dict[str, Any]]:
        query = "SELECT * FROM jobs"
        args: list[Any] = []
        if status and status != "all":
            query += " WHERE status = ?"
            args.append(status)
        query += " ORDER BY updated_at DESC LIMIT ?"
        args.append(limit)
        with self._connect() as conn:
            rows = conn.execute(query, args).fetchall()
        return [dict(row) for row in rows]

    def stats(self) -> dict[str, int]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT status, COUNT(*) AS total FROM jobs GROUP BY status"
            ).fetchall()
        result = {row["status"]: row["total"] for row in rows}
        result["total"] = sum(result.values())
        return result

    def create_job(
        self,
        source_path: Path,
        size: int,
        mtime: float,
        status: str = "analyzing",
        **fields: Any,
    ) -> int:
        timestamp = now()
        columns = ["source_path", "source_size", "source_mtime", "status",
                   "created_at", "updated_at"]
        values: list[Any] = [str(source_path), size, mtime, status, timestamp, timestamp]
        for key, value in fields.items():
            if key in JOB_FIELDS:
                columns.append(key)
                values.append(value)
        placeholders = ", ".join("?" for _ in values)
        with self._connect() as conn:
            cursor = conn.execute(
                f"INSERT INTO jobs ({', '.join(columns)}) VALUES ({placeholders})",
                values,
            )
            return int(cursor.lastrowid)

    def update_job(self, job_id: int, **fields: Any) -> None:
        updates = {key: value for key, value in fields.items() if key in JOB_FIELDS}
        if not updates:
            return
        updates["updated_at"] = now()
        assignments = ", ".join(f"{key} = ?" for key in updates)
        values = list(updates.values()) + [job_id]
        with self._connect() as conn:
            conn.execute(f"UPDATE jobs SET {assignments} WHERE id = ?", values)

    def job_json(self, job: dict[str, Any]) -> dict[str, Any]:
        result = dict(job)
        for key in ("parsed_json", "candidates_json", "llm_json"):
            value = result.get(key)
            try:
                result[key] = json.loads(value) if value else None
            except (TypeError, json.JSONDecodeError):
                result[key] = None
        return result
