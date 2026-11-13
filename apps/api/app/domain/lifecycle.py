from __future__ import annotations

from typing import Any

REVIEWABLE = {"needs_review", "ready"}

BLOCKED_REASONS = {
    "source_missing",
    "target_missing",
    "target_exists",
    "duplicate_target",
    "invalid_layout",
    "invalid_action",
    "operation_failed",
    "permission_denied",
}


def is_reviewable(job: dict[str, Any]) -> bool:
    return job.get("status") in REVIEWABLE and not job.get("blocked_reason")


def block(
    db,
    job_id: int,
    reason: str,
    message: str,
    status: str = "needs_review",
) -> None:
    db.update_job(
        job_id,
        status=status,
        blocked_reason=reason,
        error=message,
        auto_apply_eligible=0,
    )


def clear_block(db, job_id: int, reason: str | None = None) -> None:
    job = db.get_job(job_id)
    if not job:
        return
    if reason and job.get("blocked_reason") != reason:
        return
    db.update_job(job_id, blocked_reason=None, error=None)


def set_target(db, job_id: int, target_path: str | None) -> tuple[bool, dict[str, Any] | None]:
    db.release_target(job_id)
    db.update_job(job_id, target_path=target_path)
    if not target_path:
        clear_block(db, job_id, "duplicate_target")
        return True, None

    owner = db.get_target_reservation(target_path)
    if owner is not None and int(owner["job_id"]) != job_id:
        block(
            db,
            job_id,
            "duplicate_target",
            f"Duplicate target with {owner['source_path']}",
        )
        return False, owner

    if not db.reserve_target(job_id, target_path):
        owner = db.get_target_reservation(target_path)
        block(
            db,
            job_id,
            "duplicate_target",
            f"Duplicate target with {owner['source_path'] if owner else 'another job'}",
        )
        return False, owner

    clear_block(db, job_id, "duplicate_target")
    return True, None


def release(db, job_id: int) -> None:
    db.release_target(job_id)


def reject(db, job_id: int) -> None:
    release(db, job_id)
    db.cancel_operations_for_job(job_id)
    db.cancel_work_for_job(job_id)
    db.update_job(
        job_id,
        status="rejected",
        reason="Rejected.",
        error=None,
        blocked_reason=None,
        auto_apply_eligible=0,
    )
