from __future__ import annotations

import logging
import threading
import time
from pathlib import Path

from . import apply, pipeline
from . import settings as settings_mod
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
            if unchanged and existing["status"] in {
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

        if settings.auto_apply and job.get("status") == "ready":
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
            if not ok:
                logger.warning("Auto apply failed for %s: %s", path, message)

        return True
