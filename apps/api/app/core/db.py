from __future__ import annotations

import json
import os
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

JOB_FIELDS = {
    "source_size",
    "source_mtime",
    "status",
    "source",
    "group_key",
    "group_type",
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
    "blocked_reason",
    "auto_apply_eligible",
    "updated_at",
}

SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_path TEXT NOT NULL UNIQUE,
    source_size INTEGER NOT NULL,
    source_mtime REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'analyzing',
    source TEXT,
    group_key TEXT,
    group_type TEXT,
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
    blocked_reason TEXT,
    auto_apply_eligible INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);

CREATE TABLE IF NOT EXISTS target_reservations (
    target_path TEXT PRIMARY KEY,
    job_id INTEGER NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
    reserved_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    source_path TEXT NOT NULL,
    target_path TEXT NOT NULL,
    status TEXT NOT NULL,
    progress_done INTEGER NOT NULL DEFAULT 0,
    progress_total INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS job_operations_job_idx ON job_operations(job_id);

CREATE TABLE IF NOT EXISTS work_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 1,
    available_at REAL NOT NULL DEFAULT 0,
    claimed_at REAL,
    lease_until REAL,
    worker_id TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS work_items_active_unique
ON work_items(kind, job_id) WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS work_items_kind_status_idx
ON work_items(kind, status, available_at);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    csrf_token TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
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
        # Bound host mounts can reject SQLite's WAL sidecar files. The app's
        # workload is small, so use the portable rollback journal instead.
        conn.execute("PRAGMA journal_mode=DELETE")
        conn.execute("PRAGMA busy_timeout=5000")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    def _init(self) -> None:
        with self._connect() as conn:
            conn.executescript(SCHEMA)
            columns = {row["name"] for row in conn.execute("PRAGMA table_info(jobs)")}
            if "source" not in columns:
                conn.execute("ALTER TABLE jobs ADD COLUMN source TEXT")
            if "group_key" not in columns:
                conn.execute("ALTER TABLE jobs ADD COLUMN group_key TEXT")
            if "group_type" not in columns:
                conn.execute("ALTER TABLE jobs ADD COLUMN group_type TEXT")
            if "auto_apply_eligible" not in columns:
                conn.execute(
                    "ALTER TABLE jobs ADD COLUMN auto_apply_eligible INTEGER NOT NULL DEFAULT 1"
                )
            if "blocked_reason" not in columns:
                conn.execute("ALTER TABLE jobs ADD COLUMN blocked_reason TEXT")
            operation_columns = {
                row["name"] for row in conn.execute("PRAGMA table_info(job_operations)")
            }
            if "progress_done" not in operation_columns:
                conn.execute(
                    "ALTER TABLE job_operations ADD COLUMN progress_done INTEGER NOT NULL DEFAULT 0"
                )
            if "progress_total" not in operation_columns:
                conn.execute(
                    "ALTER TABLE job_operations ADD COLUMN progress_total INTEGER NOT NULL DEFAULT 0"
                )
            if "message" not in operation_columns:
                conn.execute("ALTER TABLE job_operations ADD COLUMN message TEXT")

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

    # users and sessions ----------------------------------------------

    def count_users(self) -> int:
        with self._connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS total FROM users").fetchone()
        return int(row["total"]) if row else 0

    def count_admins(self) -> int:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT COUNT(*) AS total FROM users WHERE is_admin = 1"
            ).fetchone()
        return int(row["total"]) if row else 0

    def list_users(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT id, username, is_admin, created_at, updated_at "
                "FROM users ORDER BY username"
            ).fetchall()
        return [dict(row) for row in rows]

    def get_user(self, user_id: int) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None

    def get_user_by_username(self, username: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE username = ?", (username,)
            ).fetchone()
        return dict(row) if row else None

    def create_user(
        self, username: str, password_hash: str, is_admin: bool = False
    ) -> dict[str, Any]:
        timestamp = now()
        with self._connect() as conn:
            cursor = conn.execute(
                "INSERT INTO users "
                "(username, password_hash, is_admin, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (username, password_hash, 1 if is_admin else 0, timestamp, timestamp),
            )
            user_id = int(cursor.lastrowid)
        user = self.get_user(user_id)
        if user is None:
            raise RuntimeError("Created user could not be read back")
        return user

    def update_user_password(self, user_id: int, password_hash: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
                (password_hash, now(), user_id),
            )

    def delete_user(self, user_id: int) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM users WHERE id = ?", (user_id,))

    def create_session(
        self, user_id: int, token_hash: str, csrf_token: str, expires_at: int
    ) -> int:
        with self._connect() as conn:
            cursor = conn.execute(
                "INSERT INTO sessions "
                "(user_id, token_hash, csrf_token, created_at, expires_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (user_id, token_hash, csrf_token, now(), expires_at),
            )
            return int(cursor.lastrowid)

    def get_session(self, token_hash: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT s.id AS session_id, s.user_id, s.csrf_token, s.expires_at, "
                "u.username, u.is_admin "
                "FROM sessions s JOIN users u ON u.id = s.user_id "
                "WHERE s.token_hash = ? AND s.expires_at > ?",
                (token_hash, int(time.time())),
            ).fetchone()
        return dict(row) if row else None

    def delete_session(self, token_hash: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))

    def delete_user_sessions(self, user_id: int) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))

    def purge_expired_sessions(self) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM sessions WHERE expires_at <= ?", (int(time.time()),))

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

    def get_job_by_target(
        self, target: str, exclude_id: int | None = None
    ) -> dict[str, Any] | None:
        query = (
            "SELECT * FROM jobs "
            "WHERE target_path = ? AND status NOT IN ('rejected', 'failed')"
        )
        args: list[Any] = [target]
        if exclude_id is not None:
            query += " AND id != ?"
            args.append(exclude_id)
        query += " ORDER BY id LIMIT 1"
        with self._connect() as conn:
            row = conn.execute(query, args).fetchone()
        return dict(row) if row else None

    def delete_job(self, job_id: int) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,))

    # target reservations and apply journal ----------------------------

    def get_target_reservation(self, target_path: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT r.*, j.source_path AS source_path "
                "FROM target_reservations r JOIN jobs j ON j.id = r.job_id "
                "WHERE r.target_path = ?",
                (target_path,),
            ).fetchone()
        return dict(row) if row else None

    def reserve_target(self, job_id: int, target_path: str) -> bool:
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM target_reservations WHERE job_id = ? AND target_path != ?",
                (job_id, target_path),
            )
            try:
                conn.execute(
                    "INSERT INTO target_reservations "
                    "(target_path, job_id, reserved_at) VALUES (?, ?, ?)",
                    (target_path, job_id, now()),
                )
            except sqlite3.IntegrityError:
                return False
        return True

    def release_target(self, job_id: int) -> None:
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM target_reservations WHERE job_id = ?", (job_id,)
            )

    def create_operation(
        self,
        job_id: int,
        kind: str,
        source_path: str,
        target_path: str,
        status: str = "queued",
    ) -> int:
        timestamp = now()
        with self._connect() as conn:
            cursor = conn.execute(
                "INSERT INTO job_operations "
                "(job_id, kind, source_path, target_path, status, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (job_id, kind, source_path, target_path, status, timestamp, timestamp),
            )
            return int(cursor.lastrowid)

    def update_operation(
        self,
        operation_id: int,
        status: str | None = None,
        progress_done: int | None = None,
        progress_total: int | None = None,
        message: str | None = None,
    ) -> None:
        updates: dict[str, Any] = {}
        if status is not None:
            updates["status"] = status
        if progress_done is not None:
            updates["progress_done"] = progress_done
        if progress_total is not None:
            updates["progress_total"] = progress_total
        if message is not None:
            updates["message"] = message
        if not updates:
            return
        updates["updated_at"] = now()
        assignments = ", ".join(f"{key} = ?" for key in updates)
        values = list(updates.values()) + [operation_id]
        with self._connect() as conn:
            conn.execute(
                f"UPDATE job_operations SET {assignments} WHERE id = ?", values
            )

    def latest_operation(self, job_id: int) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM job_operations WHERE job_id = ? "
                "ORDER BY id DESC LIMIT 1",
                (job_id,),
            ).fetchone()
        return dict(row) if row else None

    def get_operation(self, operation_id: int) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM job_operations WHERE id = ?", (operation_id,)
            ).fetchone()
        return dict(row) if row else None

    def active_operation_for_job(self, job_id: int) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM job_operations WHERE job_id = ? "
                "AND status IN ('queued', 'running') ORDER BY id LIMIT 1",
                (job_id,),
            ).fetchone()
        return dict(row) if row else None

    def list_operations(
        self, statuses: tuple[str, ...] | None = None, limit: int = 50
    ) -> list[dict[str, Any]]:
        query = (
            "SELECT o.*, j.title AS job_title, j.status AS job_status "
            "FROM job_operations o JOIN jobs j ON j.id = o.job_id"
        )
        args: list[Any] = []
        if statuses:
            placeholders = ", ".join("?" for _ in statuses)
            query += f" WHERE o.status IN ({placeholders})"
            args.extend(statuses)
        query += " ORDER BY o.id DESC LIMIT ?"
        args.append(limit)
        with self._connect() as conn:
            rows = conn.execute(query, args).fetchall()
        return [dict(row) for row in rows]

    def cancel_operations_for_job(self, job_id: int) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE job_operations SET status = 'cancelled', message = ?, "
                "updated_at = ? WHERE job_id = ? AND status = 'queued'",
                ("Cancelled before starting.", now(), job_id),
            )

    def fail_interrupted_operations(self) -> None:
        timestamp = now()
        with self._connect() as conn:
            conn.execute(
                "UPDATE job_operations SET status = 'failed', message = ?, "
                "updated_at = ? WHERE status = 'running'",
                ("Interrupted by restart.", timestamp),
            )

    # durable work queue ----------------------------------------------

    def enqueue_work(
        self, kind: str, job_id: int, max_attempts: int = 1
    ) -> int:
        timestamp = now()
        with self._connect() as conn:
            try:
                cursor = conn.execute(
                    "INSERT INTO work_items "
                    "(kind, job_id, status, attempts, max_attempts, available_at, "
                    "created_at, updated_at) VALUES (?, ?, 'queued', 0, ?, ?, ?, ?)",
                    (kind, job_id, max_attempts, time.time(), timestamp, timestamp),
                )
                return int(cursor.lastrowid)
            except sqlite3.IntegrityError:
                row = conn.execute(
                    "SELECT id FROM work_items WHERE kind = ? AND job_id = ? "
                    "AND status IN ('queued', 'running') ORDER BY id LIMIT 1",
                    (kind, job_id),
                ).fetchone()
                if row:
                    return int(row["id"])
                raise

    def claim_work(
        self, kind: str, worker_id: str, lease_seconds: float = 60
    ) -> dict[str, Any] | None:
        now_ts = time.time()
        timestamp = now()
        with self._connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            conn.execute(
                "UPDATE work_items SET status = 'failed', "
                "last_error = COALESCE(last_error, 'Retry limit reached'), "
                "updated_at = ? WHERE kind = ? "
                "AND ((status = 'running' AND lease_until < ?) "
                "OR status = 'queued') AND attempts >= max_attempts",
                (timestamp, kind, now_ts),
            )
            row = conn.execute(
                "SELECT * FROM work_items WHERE kind = ? AND attempts < max_attempts "
                "AND ((status = 'queued' AND available_at <= ?) "
                "OR (status = 'running' AND lease_until < ?)) "
                "ORDER BY id LIMIT 1",
                (kind, now_ts, now_ts),
            ).fetchone()
            if row is None:
                conn.commit()
                return None
            conn.execute(
                "UPDATE work_items SET status = 'running', attempts = attempts + 1, "
                "claimed_at = ?, lease_until = ?, worker_id = ?, updated_at = ? "
                "WHERE id = ?",
                (now_ts, now_ts + lease_seconds, worker_id, timestamp, row["id"]),
            )
            claimed = conn.execute(
                "SELECT * FROM work_items WHERE id = ?", (row["id"],)
            ).fetchone()
            conn.commit()
        return dict(claimed) if claimed else None

    def heartbeat_work(
        self, work_id: int, worker_id: str, lease_seconds: float = 60
    ) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE work_items SET lease_until = ?, updated_at = ? "
                "WHERE id = ? AND worker_id = ? AND status = 'running'",
                (time.time() + lease_seconds, now(), work_id, worker_id),
            )

    def complete_work(
        self, work_id: int, status: str = "completed", error: str | None = None
    ) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE work_items SET status = ?, last_error = ?, "
                "lease_until = NULL, updated_at = ? WHERE id = ?",
                (status, error, now(), work_id),
            )

    def cancel_work_for_job(self, job_id: int, kinds: tuple[str, ...] | None = None) -> None:
        query = (
            "UPDATE work_items SET status = 'cancelled', "
            "last_error = 'Cancelled by user.', updated_at = ? "
            "WHERE job_id = ? AND status = 'queued'"
        )
        args: list[Any] = [now(), job_id]
        if kinds:
            placeholders = ", ".join("?" for _ in kinds)
            query += f" AND kind IN ({placeholders})"
            args.extend(kinds)
        with self._connect() as conn:
            conn.execute(query, args)

    def active_work_for_job(
        self, job_id: int, kind: str | None = None
    ) -> dict[str, Any] | None:
        query = (
            "SELECT * FROM work_items WHERE job_id = ? "
            "AND status IN ('queued', 'running')"
        )
        args: list[Any] = [job_id]
        if kind:
            query += " AND kind = ?"
            args.append(kind)
        query += " ORDER BY id LIMIT 1"
        with self._connect() as conn:
            row = conn.execute(query, args).fetchone()
        return dict(row) if row else None

    def recover_running_work(self) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE work_items SET status = 'queued', available_at = ?, "
                "claimed_at = NULL, lease_until = NULL, worker_id = NULL, "
                "updated_at = ? WHERE status = 'running'",
                (time.time(), now()),
            )

    def work_counts(self) -> dict[str, dict[str, int]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT kind, status, COUNT(*) AS total FROM work_items "
                "WHERE status IN ('queued', 'running') GROUP BY kind, status"
            ).fetchall()
        result: dict[str, dict[str, int]] = {}
        for row in rows:
            result.setdefault(row["kind"], {})[row["status"]] = int(row["total"])
        return result

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
        fields = dict(fields)
        fields.setdefault("status", status)
        columns = ["source_path", "source_size", "source_mtime", "created_at", "updated_at"]
        values: list[Any] = [str(source_path), size, mtime, timestamp, timestamp]
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
