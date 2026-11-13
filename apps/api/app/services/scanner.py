from __future__ import annotations

import logging
import threading
import time
from pathlib import Path

from ..domain import lifecycle
from ..domain import settings as settings_mod
from .providers import JellyfinProvider, LLM

logger = logging.getLogger(__name__)

SKIP_DIRS = {"@eadir", "#recycle", "sample", "samples"}


class Scanner:
    def __init__(
        self,
        cfg,
        db,
        jellyfin: JellyfinProvider,
        llm: LLM,
    ):
        self.cfg = cfg
        self.db = db
        self.jellyfin = jellyfin
        self.llm = llm
        self._stop = threading.Event()
        self._wake = threading.Event()
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()
        self._pending: dict[str, tuple[int, float, float]] = {}
        self._status_lock = threading.Lock()
        self._status: dict[str, object] = {
            "running": False,
            "stage": "idle",
            "started_at": None,
            "finished_at": None,
            "processed": 0,
            "total": 0,
            "current": None,
            "error": None,
        }

    def status(self) -> dict[str, object]:
        with self._status_lock:
            return dict(self._status)

    def _set_status(self, **updates: object) -> None:
        with self._status_lock:
            self._status.update(updates)

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._thread = threading.Thread(target=self._loop, name="scanner", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._wake.set()
        if self._thread:
            self._thread.join(timeout=10)

    def trigger(self) -> None:
        self._wake.set()

    def _loop(self) -> None:
        while not self._stop.is_set():
            self._set_status(
                running=True,
                stage="scanning",
                started_at=time.time(),
                finished_at=None,
                processed=0,
                total=0,
                current=None,
                error=None,
            )
            try:
                current = settings_mod.load(self.db)
                self.scan_once(current)
            except Exception as exc:
                self._set_status(error=str(exc))
                logger.exception("Scan failed")
            finally:
                self._set_status(
                    running=False,
                    stage="idle",
                    finished_at=time.time(),
                    current=None,
                )

            try:
                interval = settings_mod.load(self.db).poll_interval
            except Exception:
                interval = 60
            self._wake.wait(timeout=max(1, interval))
            self._wake.clear()

    def scan_once(self, settings: settings_mod.Settings | None = None) -> int:
        if settings is None:
            settings = settings_mod.load(self.db)

        with self._lock:
            processed = 0
            seen: set[str] = set()
            files: list[tuple[Path, str]] = []
            for root, forced_kind in (
                (self.cfg.movie_watch_dir, "movie"),
                (self.cfg.show_watch_dir, "tv"),
            ):
                if not root.exists():
                    continue
                files.extend(
                    (path, forced_kind)
                    for path in self._iter_files(settings, root)
                )
            self._set_status(total=len(files), processed=0)

            for path, forced_kind in files:
                key = str(path)
                seen.add(key)
                self._set_status(current=str(path))
                if not self._stable(path, settings):
                    continue
                if self._process(path, settings, forced_kind):
                    processed += 1
                self._set_status(processed=processed)

            for key in list(self._pending):
                if key not in seen:
                    self._pending.pop(key, None)

            self._set_status(stage="reconciling", current=None)
            self._reconcile_jobs()
            self._set_status(stage="finished")

            return processed

    def _iter_files(self, settings: settings_mod.Settings, root: Path):
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            try:
                relative = path.relative_to(root)
            except ValueError:
                continue
            if any(part.startswith(".") or part.lower() in SKIP_DIRS for part in relative.parts):
                continue
            if path.suffix.lower().lstrip(".") not in settings.extension_set:
                continue
            if path.name.lower().endswith((".part", ".tmp", ".!qb", ".!ut")):
                continue
            try:
                if path.stat().st_size < settings.min_size_mb * 1024 * 1024:
                    continue
            except OSError:
                continue
            yield path

    def _stable(self, path: Path, settings: settings_mod.Settings) -> bool:
        if settings.stable_seconds <= 0:
            return True

        try:
            stat = path.stat()
        except OSError:
            return False

        key = str(path)
        previous = self._pending.get(key)
        now = time.time()

        if previous and previous[0] == stat.st_size and previous[1] == stat.st_mtime:
            if now - previous[2] >= settings.stable_seconds:
                self._pending.pop(key, None)
                return True
            return False

        self._pending[key] = (stat.st_size, stat.st_mtime, now)
        return False

    def _process(self, path: Path, settings: settings_mod.Settings, forced_kind: str) -> bool:
        try:
            stat = path.stat()
        except OSError:
            return False

        existing = self.db.get_job_by_source(str(path))
        if existing:
            unchanged = (
                existing["source_size"] == stat.st_size
                and existing["source_mtime"] == stat.st_mtime
            )
            if unchanged:
                if existing.get("status") == "analyzing":
                    if self.db.active_work_for_job(int(existing["id"]), "metadata"):
                        return False
                    self.db.enqueue_work("metadata", int(existing["id"]), 3)
                    return True
                if (
                    existing.get("status") == "failed"
                    and existing.get("error") == "Source file is missing."
                ):
                    self.db.update_job(
                        int(existing["id"]),
                        status="analyzing",
                        error=None,
                        blocked_reason=None,
                        target_path=None,
                    )
                    self.db.enqueue_work("metadata", int(existing["id"]), 3)
                    return True
                if existing.get("status") in {
                    "moved", "rejected", "ready", "needs_review"
                }:
                    return False

            lifecycle.release(self.db, int(existing["id"]))
            self.db.update_job(
                int(existing["id"]),
                source_size=stat.st_size,
                source_mtime=stat.st_mtime,
                status="analyzing",
                target_path=None,
                error=None,
                blocked_reason=None,
                auto_apply_eligible=1,
            )
            self.db.enqueue_work("metadata", int(existing["id"]), 3)
            return True

        job_id = self.db.create_job(
            path,
            stat.st_size,
            stat.st_mtime,
            status="analyzing",
            media_type="tv" if forced_kind == "tv" else "movie",
        )
        self.db.enqueue_work("metadata", job_id, 3)
        return True

    def _reconcile_jobs(self) -> None:
        jobs = self.db.list_jobs(limit=1000)
        ordered = sorted(
            jobs, key=lambda item: (item.get("status") != "moved", item["id"])
        )
        for job in ordered:
            job_id = int(job["id"])
            status = job.get("status")
            target_path = job.get("target_path")
            if status in {"rejected", "failed"} or not target_path:
                self.db.release_target(job_id)
                continue
            owner = self.db.get_target_reservation(target_path)
            if owner is not None and int(owner["job_id"]) != job_id:
                message = f"Duplicate target with {owner['source_path']}"
                if (
                    job.get("blocked_reason") != "duplicate_target"
                    or job.get("error") != message
                ):
                    if status == "moved":
                        self.db.update_job(
                            job_id,
                            blocked_reason="duplicate_target",
                            error=message,
                            auto_apply_eligible=0,
                        )
                    else:
                        lifecycle.block(
                            self.db, job_id, "duplicate_target", message
                        )
                continue
            if owner is None and not self.db.reserve_target(job_id, target_path):
                owner = self.db.get_target_reservation(target_path)
                message = (
                    f"Duplicate target with {owner['source_path']}"
                    if owner
                    else "Duplicate target with another job"
                )
                lifecycle.block(self.db, job_id, "duplicate_target", message)
                continue
            if job.get("blocked_reason") == "duplicate_target":
                lifecycle.clear_block(self.db, job_id, "duplicate_target")

        for job in jobs:
            status = job.get("status")
            job_id = int(job["id"])
            if status == "rejected":
                continue
            source = Path(job["source_path"])
            if status == "moved":
                target = Path(job["target_path"] or "")
                if job.get("target_path") and not target.exists():
                    if (
                        job.get("blocked_reason") != "target_missing"
                        or job.get("error") != "Target file is missing."
                    ):
                        self.db.update_job(
                            job_id,
                            blocked_reason="target_missing",
                            error="Target file is missing.",
                            auto_apply_eligible=0,
                        )
                continue
            if status not in {"analyzing", "needs_review", "ready", "failed"}:
                continue
            if source.exists():
                continue
            if status == "failed" and job.get("blocked_reason") == "source_missing":
                continue
            self.db.release_target(job_id)
            lifecycle.block(
                self.db,
                job_id,
                "source_missing",
                "Source file is missing.",
                status="failed",
            )
            self.db.update_job(job_id, target_path=None)
