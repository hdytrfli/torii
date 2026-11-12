from __future__ import annotations

import logging
import threading
import time
from pathlib import Path

from ..domain import lifecycle, pipeline
from ..domain import settings as settings_mod
from . import apply
from .providers import JellyfinProvider, LLM

logger = logging.getLogger(__name__)

SKIP_DIRS = {"@eadir", "#recycle", "sample", "samples"}


class Scanner:
    def __init__(self, cfg, db, jellyfin: JellyfinProvider, llm: LLM):
        self.cfg = cfg
        self.db = db
        self.jellyfin = jellyfin
        self.llm = llm
        self._stop = threading.Event()
        self._wake = threading.Event()
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()
        self._pending: dict[str, tuple[int, float, float]] = {}

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
            try:
                current = settings_mod.load(self.db)
                self.scan_once(current)
            except Exception:
                logger.exception("Scan failed")

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

            for root, forced_kind in (
                (self.cfg.movie_watch_dir, "movie"),
                (self.cfg.show_watch_dir, "tv"),
            ):
                if not root.exists():
                    continue
                for path in self._iter_files(settings, root):
                    key = str(path)
                    seen.add(key)
                    if not self._stable(path, settings):
                        continue
                    if self._process(path, settings, forced_kind):
                        processed += 1

            for key in list(self._pending):
                if key not in seen:
                    self._pending.pop(key, None)

            self._reconcile_jobs()
            if settings.auto_apply:
                self._auto_apply_existing(settings)

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
            recovering = (
                existing["status"] == "failed"
                and existing.get("error") == "Source file is missing."
            )
            if unchanged and not recovering and existing["status"] in {
                "moved", "rejected", "needs_review", "ready", "failed"
            }:
                return False

        job = pipeline.analyze(
            self.cfg,
            settings,
            self.db,
            path,
            self.jellyfin,
            self.llm,
            forced_kind=forced_kind,
        )
        if not job:
            return False

        lifecycle.set_target(self.db, int(job["id"]), job.get("target_path"))
        job = self.db.get_job(int(job["id"])) or job

        if settings.auto_apply and job.get("status") == "ready":
            self._apply_auto(settings, job, path)

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

    def _auto_apply_existing(self, settings: settings_mod.Settings) -> None:
        for job in self.db.list_jobs(limit=1000):
            if job.get("status") not in {"needs_review", "ready"}:
                continue
            if not job.get("auto_apply_eligible", 1) or job.get("blocked_reason"):
                continue
            if job.get("error") or not job.get("title"):
                continue
            if job.get("media_type") not in {"movie", "tv"}:
                continue
            if float(job.get("confidence") or 0) < settings.auto_apply_confidence:
                continue
            source = Path(job["source_path"])
            if not source.exists():
                continue
            self._apply_auto(settings, job, source)

    def _apply_auto(
        self, settings: settings_mod.Settings, job: dict, source: Path
    ) -> None:
        ok, message, _ = apply.apply_job(
            self.cfg,
            settings,
            self.db,
            job,
            job["title"],
            job["year"],
            job["media_type"],
            job["season"],
            job["episode"],
        )
        if ok:
            logger.info("Auto applied %s: %s", source, message)
        else:
            logger.warning("Auto apply failed for %s: %s", source, message)
