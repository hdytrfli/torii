from __future__ import annotations

import logging
import threading
import time
import uuid
from pathlib import Path

from ..domain import lifecycle, pipeline
from ..domain import settings as settings_mod
from . import apply

logger = logging.getLogger(__name__)

LEASE_SECONDS = 120
HEARTBEAT_SECONDS = 30
QUEUE_KINDS = ("metadata", "execution", "revert")
POLL_FIELDS = {
    "metadata": "queue_metadata_poll",
    "promotion": "queue_promotion_poll",
    "execution": "queue_execution_poll",
    "revert": "queue_revert_poll",
}


class OperationQueue:
    def __init__(self, cfg, db, jellyfin=None, llm=None):
        self.cfg = cfg
        self.db = db
        self.jellyfin = jellyfin
        self.llm = llm
        self._stop = threading.Event()
        self._threads: list[threading.Thread] = []
        self._wake = {kind: threading.Event() for kind in QUEUE_KINDS}

    def start(self) -> None:
        self._cleanup_partial_files()
        self.db.fail_interrupted_operations()
        self.db.recover_running_work()
        for kind in QUEUE_KINDS:
            thread = threading.Thread(
                target=self._worker_loop,
                args=(kind,),
                name=f"torii-{kind}",
                daemon=True,
            )
            thread.start()
            self._threads.append(thread)
        scheduler = threading.Thread(
            target=self._scheduler_loop, name="torii-scheduler", daemon=True
        )
        scheduler.start()
        self._threads.append(scheduler)

    def stop(self) -> None:
        self._stop.set()
        for event in self._wake.values():
            event.set()
        for thread in self._threads:
            thread.join(timeout=5)

    def _cleanup_partial_files(self) -> None:
        for root in self.cfg.library_dirs:
            if not root.exists():
                continue
            for path in root.rglob("*.torii-part"):
                try:
                    path.unlink()
                except OSError:
                    logger.warning("Could not remove partial file %s", path)

    def _poll_seconds(self, kind: str) -> float:
        field = POLL_FIELDS[kind]
        try:
            return float(max(1, getattr(settings_mod.load(self.db), field, 1)))
        except Exception:
            return 1.0

    def _worker_loop(self, kind: str) -> None:
        worker_id = f"{kind}:{uuid.uuid4().hex[:8]}"
        while not self._stop.is_set():
            item = self.db.claim_work(kind, worker_id, LEASE_SECONDS)
            if item is None:
                self._wake[kind].wait(self._poll_seconds(kind))
                self._wake[kind].clear()
                continue

            heartbeat_stop = threading.Event()

            def heartbeat() -> None:
                while not heartbeat_stop.wait(HEARTBEAT_SECONDS):
                    self.db.heartbeat_work(
                        int(item["id"]), worker_id, LEASE_SECONDS
                    )

            heartbeat_thread = threading.Thread(
                target=heartbeat, name=f"torii-{kind}-heartbeat", daemon=True
            )
            heartbeat_thread.start()
            try:
                error = self._handle(kind, item)
                self.db.complete_work(
                    int(item["id"]),
                    "failed" if error else "completed",
                    error,
                )
            except Exception as exc:
                logger.exception("%s worker failed", kind)
                self.db.complete_work(int(item["id"]), "failed", str(exc))
                job = self.db.get_job(int(item["job_id"]))
                if job:
                    lifecycle.block(
                        self.db,
                        int(job["id"]),
                        "operation_failed",
                        f"{kind} failed: {exc}",
                    )
            finally:
                heartbeat_stop.set()
                heartbeat_thread.join(timeout=2)

    def _handle(self, kind: str, item: dict) -> str | None:
        job = self.db.get_job(int(item["job_id"]))
        if job is None:
            return None
        settings = settings_mod.load(self.db)

        if kind == "metadata":
            return self._handle_metadata(job, settings)
        if kind == "execution":
            return self._handle_execution(job, settings)
        if kind == "revert":
            return self._handle_revert(job, settings)
        return f"Unknown queue kind: {kind}"

    def _handle_metadata(self, job: dict, settings) -> str | None:
        if job.get("status") in {"moved", "rejected", "waiting_revert"}:
            return None
        source = Path(job["source_path"])
        if not source.exists():
            lifecycle.release(self.db, int(job["id"]))
            lifecycle.block(
                self.db,
                int(job["id"]),
                "source_missing",
                "Source file is missing.",
                status="failed",
            )
            return "Source file is missing."

        if self.jellyfin is None or self.llm is None:
            from ..api import deps

            self.jellyfin = self.jellyfin or deps.jellyfin
            self.llm = self.llm or deps.llm
        updated = pipeline.analyze(
            self.cfg,
            settings,
            self.db,
            source,
            self.jellyfin,
            self.llm,
            forced_kind="tv" if job.get("media_type") == "tv" else "movie",
        )
        if not updated:
            lifecycle.block(
                self.db,
                int(job["id"]),
                "operation_failed",
                "Metadata analysis produced no job.",
            )
            return "Metadata analysis produced no job."

        if updated.get("target_path"):
            lifecycle.set_target(
                self.db, int(job["id"]), updated.get("target_path")
            )
        return None

    def _handle_execution(self, job: dict, settings) -> str | None:
        if job.get("status") == "moved":
            return None
        if job.get("status") != "ready":
            return None

        source = Path(job["source_path"])
        target = Path(job.get("target_path") or "")
        if job.get("target_path") and target.exists():
            operation = self.db.latest_operation(int(job["id"]))
            kind = operation["kind"] if operation else None
            likely_committed = not source.exists() or kind in {"copy", "hardlink"}
            if likely_committed:
                if operation and operation["status"] != "reversed":
                    self.db.update_operation(int(operation["id"]), "committed")
                self.db.update_job(
                    int(job["id"]),
                    status="moved",
                    error=None,
                    blocked_reason=None,
                    reason="Recovered completed apply.",
                )
                return None

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
        return None if ok else message

    def _handle_revert(self, job: dict, settings) -> str | None:
        if job.get("status") not in {"moved", "waiting_revert"}:
            return None
        ok, message = apply.undo_job(self.cfg, settings, self.db, job)
        return None if ok else message

    def _scheduler_loop(self) -> None:
        while not self._stop.is_set():
            try:
                self.promote_ready()
                self.enqueue_ready_jobs()
            except Exception:
                logger.exception("Queue scheduler failed")
            self._stop.wait(self._poll_seconds("promotion"))

    def promotion_candidates(self, settings=None) -> list[dict]:
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
        self.enqueue_ready_jobs()

    def enqueue_ready_jobs(self) -> None:
        for job in self.db.list_jobs("ready", limit=1000):
            job_id = int(job["id"])
            if job.get("blocked_reason") or job.get("error"):
                continue
            if self.db.active_work_for_job(job_id, "execution") is not None:
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
            self.db.enqueue_work("execution", job_id, max_attempts=3)
            self._wake["execution"].set()

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
        active = self.db.active_work_for_job(int(job["id"]))
        if active is not None:
            return int(active["id"])
        self.db.update_job(
            int(job["id"]),
            title=title,
            year=year,
            media_type=media_type,
            season=season,
            episode=episode,
            status="ready",
            blocked_reason=None,
            error=None,
            auto_apply_eligible=0,
        )
        work_id = self.db.enqueue_work(
            "execution", int(job["id"]), max_attempts=3
        )
        self._wake["execution"].set()
        return work_id

    def enqueue_auto(self, settings, job: dict) -> int:
        return self.enqueue_apply(
            job,
            job["title"],
            job["year"],
            job["media_type"],
            job["season"],
            job["episode"],
            settings.action,
        )

    def enqueue_revert(self, job: dict) -> int:
        if job.get("status") != "moved":
            raise ValueError("Only applied jobs can be reverted.")
        active = self.db.active_work_for_job(int(job["id"]), "revert")
        if active is not None:
            return int(active["id"])
        self.db.update_job(
            int(job["id"]),
            status="waiting_revert",
            blocked_reason=None,
            error=None,
        )
        work_id = self.db.enqueue_work("revert", int(job["id"]), max_attempts=3)
        self._wake["revert"].set()
        return work_id

    def status(self) -> dict:
        active = self.db.list_operations(("queued", "running"), limit=100)
        running = next(
            (item for item in active if item["status"] == "running"), None
        )
        ready_jobs = [
            job
            for job in self.db.list_jobs("ready", limit=1000)
            if not job.get("blocked_reason") and not job.get("error")
        ]
        counts = self.db.work_counts()
        promotion = len(self.promotion_candidates())
        metadata = counts.get("metadata", {}).get("queued", 0) + counts.get(
            "metadata", {}
        ).get("running", 0)
        execution_queued = counts.get("execution", {}).get("queued", 0)
        execution = max(execution_queued, len(ready_jobs))
        revert = counts.get("revert", {}).get("queued", 0) + counts.get(
            "revert", {}
        ).get("running", 0)
        queued = metadata + promotion + execution + revert
        return {
            "running": running,
            "queued": queued,
            "ready": len(ready_jobs),
            "metadata": metadata,
            "promotion": promotion,
            "execution": execution,
            "revert": revert,
            "active": active,
            "recent": self.db.list_operations(limit=10),
        }
