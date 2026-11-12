from __future__ import annotations

import logging
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
            if job.get("status") == "applying" and not self.db.active_operation_for_job(
                int(job["id"])
            ):
                lifecycle.block(
                    self.db,
                    int(job["id"]),
                    "operation_failed",
                    "Apply was interrupted before it started.",
                )
        queued = self.db.list_operations(("queued",), limit=1000)
        for operation in sorted(queued, key=lambda item: item["id"]):
            self._submit(int(operation["id"]))

    def stop(self) -> None:
        self.executor.shutdown(wait=False, cancel_futures=True)

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
            status="applying",
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
        queued = sum(1 for item in active if item["status"] == "queued")
        return {
            "running": running,
            "queued": queued,
            "active": active,
            "recent": self.db.list_operations(limit=10),
        }

    def _submit(self, operation_id: int) -> None:
        self.executor.submit(self._run, operation_id)

    def _run(self, operation_id: int) -> None:
        operation = self.db.get_operation(operation_id)
        if operation is None:
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
