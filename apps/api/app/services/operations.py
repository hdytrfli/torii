from __future__ import annotations

import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from ..domain import lifecycle
from ..domain import settings as settings_mod
from . import apply

logger = logging.getLogger(__name__)


class OperationQueue:
    def __init__(self, cfg, db):
        self.cfg = cfg
        self.db = db
        self.executor = ThreadPoolExecutor(
            max_workers=1, thread_name_prefix="torii-apply"
        )
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        interrupted = self.db.list_operations(("running",), limit=1000)
        self.db.fail_interrupted_operations()
        for operation in interrupted:
            lifecycle.block(
                self.db,
                int(operation["job_id"]),
                "operation_failed",
                "Apply interrupted by restart.",
            )
        for job in self.db.list_jobs(limit=1000):
            if job.get("status") != "applying":
                continue
            if self.db.active_operation_for_job(int(job["id"])):
                self.db.update_job(int(job["id"]), status="ready")
            else:
                lifecycle.block(
                    self.db,
                    int(job["id"]),
                    "operation_failed",
                    "Apply was interrupted before it started.",
                )
        queued = self.db.list_operations(("queued",), limit=1000)
        for operation in sorted(queued, key=lambda item: item["id"]):
            self._submit(int(operation["id"]))
        self.promote_ready()
        self.scan_ready()
        self._thread = threading.Thread(
            target=self._dispatch_loop, name="torii-dispatch", daemon=True
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)
        self.executor.shutdown(wait=False, cancel_futures=True)

    def _dispatch_loop(self) -> None:
        while not self._stop.is_set():
            try:
                self.promote_ready()
                self.scan_ready()
            except Exception:
                logger.exception("Ready queue dispatch failed")
            self._stop.wait(1.0)

    def promotion_candidates(
        self, settings: settings_mod.Settings | None = None
    ) -> list[dict]:
        current = settings or settings_mod.load(self.db)
        if not current.auto_apply:
            return []
        candidates = []
        for job in self.db.list_jobs("needs_review", limit=1000):
            if job.get("blocked_reason") or job.get("error"):
                continue
            if float(job.get("confidence") or 0) < current.auto_apply_confidence:
                continue
            if not Path(job["source_path"]).exists():
                continue
            candidates.append(job)
        return candidates

    def promote_ready(self) -> None:
        settings = settings_mod.load(self.db)
        for job in self.promotion_candidates(settings):
            job_id = int(job["id"])
            target_path = job.get("target_path")
            if not target_path:
                target_path = apply.preview_target(
                    self.cfg,
                    settings,
                    job,
                    job["title"],
                    job["year"],
                    job["media_type"],
                    job["season"],
                    job["episode"],
                )
                if target_path.startswith("Invalid layout:"):
                    lifecycle.block(
                        self.db, job_id, "invalid_layout", target_path
                    )
                    continue
            lifecycle.set_target(self.db, job_id, target_path)
            updated = self.db.get_job(job_id) or {}
            if updated.get("blocked_reason"):
                continue
            self.db.update_job(
                job_id,
                status="ready",
                auto_apply_eligible=1,
                reason="Ready to apply: confidence threshold met.",
            )

    def scan_ready(self) -> None:
        settings = settings_mod.load(self.db)
        for job in self.db.list_jobs("ready", limit=1000):
            job_id = int(job["id"])
            if job.get("blocked_reason") or job.get("error"):
                continue
            if self.db.active_operation_for_job(job_id) is not None:
                continue
            source = Path(job["source_path"])
            if not source.exists():
                lifecycle.release(self.db, job_id)
                lifecycle.block(
                    self.db,
                    job_id,
                    "source_missing",
                    "Source file is missing.",
                    status="failed",
                )
                continue
            try:
                self.enqueue_apply(
                    job,
                    job["title"],
                    job["year"],
                    job["media_type"],
                    job["season"],
                    job["episode"],
                    settings.action,
                )
            except ValueError:
                logger.warning("Could not queue ready job %s", job_id)

    def enqueue_apply(
        self,
        job: dict,
        title: str,
        year: int | None,
        media_type: str,
        season: int | None,
        episode: int | None,
        action: str | None = None,
    ) -> int:
        if job.get("status") not in {"needs_review", "ready"}:
            raise ValueError("Only review jobs can be applied.")
        existing = self.db.active_operation_for_job(int(job["id"]))
        if existing is not None:
            return int(existing["id"])

        settings = settings_mod.load(self.db)
        kind = (action or settings.action).lower()
        operation_id = self.db.create_operation(
            int(job["id"]),
            kind,
            job["source_path"],
            job.get("target_path") or "",
            status="queued",
        )
        self.db.update_job(
            int(job["id"]),
            status="ready",
            blocked_reason=None,
            error=None,
            auto_apply_eligible=0,
        )
        self._submit(operation_id)
        return operation_id

    def enqueue_auto(self, settings: settings_mod.Settings, job: dict) -> int:
        return self.enqueue_apply(
            job,
            job["title"],
            job["year"],
            job["media_type"],
            job["season"],
            job["episode"],
            settings.action,
        )

    def status(self) -> dict:
        active = self.db.list_operations(("queued", "running"), limit=100)
        running = next(
            (item for item in active if item["status"] == "running"), None
        )
        queued_operations = sum(1 for item in active if item["status"] == "queued")
        ready_jobs = [
            job
            for job in self.db.list_jobs("ready", limit=1000)
            if not job.get("blocked_reason") and not job.get("error")
        ]
        promotion = len(self.promotion_candidates())
        queued = max(queued_operations, len(ready_jobs))
        return {
            "running": running,
            "queued": queued,
            "ready": len(ready_jobs),
            "promotion": promotion,
            "active": active,
            "recent": self.db.list_operations(limit=10),
        }

    def _submit(self, operation_id: int) -> None:
        self.executor.submit(self._run, operation_id)

    def _run(self, operation_id: int) -> None:
        operation = self.db.get_operation(operation_id)
        if operation is None or operation["status"] != "queued":
            return
        job = self.db.get_job(int(operation["job_id"]))
        if job is None:
            self.db.update_operation(
                operation_id, status="failed", message="Job no longer exists."
            )
            return

        self.db.update_operation(
            operation_id,
            status="running",
            progress_done=0,
            progress_total=0,
            message="Starting",
        )
        settings = settings_mod.load(self.db)
        last_report = 0.0

        def report(done: int, total: int) -> None:
            nonlocal last_report
            now = time.time()
            if done < total and now - last_report < 0.5:
                return
            last_report = now
            self.db.update_operation(
                operation_id,
                progress_done=done,
                progress_total=total,
                message="Copying" if operation["kind"] == "copy" else "Applying",
            )

        try:
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
                operation["kind"],
                operation_id,
                report,
            )
        except Exception as exc:
            logger.exception("Queued apply failed")
            self.db.update_operation(
                operation_id, status="failed", message=str(exc)
            )
            lifecycle.block(
                self.db,
                int(job["id"]),
                "operation_failed",
                f"Apply failed: {exc}",
            )
            return

        if not ok:
            self.db.update_operation(
                operation_id, status="failed", message=message
            )
        logger.info("Apply operation %s finished: %s", operation_id, message)
