from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, Request

from ...core import auth
from ...domain import pipeline
from ...domain import settings as settings_mod
from ...services import apply
from .. import deps
from ..schemas import ApproveBody, BulkBody

router = APIRouter(prefix="/api", tags=["jobs"])


@router.get("/jobs")
def list_jobs(
    request: Request,
    status: str = "all",
    limit: int = Query(default=500, ge=1, le=2000),
):
    deps.current_session(request)
    return [deps.db.job_json(job) for job in deps.db.list_jobs(status, limit=limit)]


@router.get("/stats")
def stats(request: Request):
    deps.current_session(request)
    return deps.db.stats()


@router.get("/groups")
def list_groups(
    request: Request,
    status: str = "needs_review",
    limit: int = Query(default=1000, ge=1, le=5000),
):
    deps.current_session(request)
    return deps.group_jobs(deps.db.list_jobs(status, limit=limit))


@router.get("/jobs/{job_id}")
def get_job(request: Request, job_id: int):
    deps.current_session(request)
    job = deps.db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return deps.db.job_json(job)


@router.post("/jobs/{job_id}/approve")
def approve(request: Request, job_id: int, body: ApproveBody):
    deps.current_session(request)
    job = deps.db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    ok, message, target = apply.apply_job(
        deps.cfg,
        settings_mod.load(deps.db),
        deps.db,
        job,
        body.title,
        body.year,
        body.media_type,
        body.season,
        body.episode,
        body.action,
    )
    return {"ok": ok, "message": message, "target": str(target) if target else None}


@router.post("/jobs/{job_id}/preview")
def preview(request: Request, job_id: int, body: ApproveBody):
    deps.current_session(request)
    job = deps.db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    target = apply.preview_target(
        deps.cfg,
        settings_mod.load(deps.db),
        job,
        body.title,
        body.year,
        body.media_type,
        body.season,
        body.episode,
    )
    return {"target": target}


@router.post("/jobs/{job_id}/reject")
def reject(request: Request, job_id: int):
    deps.current_session(request)
    job = deps.db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    deps.db.update_job(job_id, status="rejected", error=None)
    return {"ok": True}


@router.post("/jobs/{job_id}/retry")
def retry(request: Request, job_id: int):
    deps.current_session(request)
    job = deps.db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    path = Path(job["source_path"])
    if not path.exists():
        raise HTTPException(status_code=400, detail="Source file no longer exists")
    updated = pipeline.analyze(
        deps.cfg,
        settings_mod.load(deps.db),
        deps.db,
        path,
        deps.jellyfin,
        deps.llm,
        forced_kind="tv" if job.get("media_type") == "tv" else "movie",
    )
    return {"ok": True, "job": deps.db.job_json(updated)}


@router.post("/jobs/bulk")
def bulk(request: Request, body: BulkBody):
    deps.current_session(request)
    results = []
    current_settings = settings_mod.load(deps.db)
    for job_id in body.ids:
        job = deps.db.get_job(job_id)
        if not job:
            results.append({"id": job_id, "ok": False, "message": "Job not found"})
            continue
        if body.action == "reject":
            deps.db.update_job(job_id, status="rejected", error=None)
            results.append({"id": job_id, "ok": True, "message": "Rejected"})
            continue
        ok, message, target = apply.apply_job(
            deps.cfg,
            current_settings,
            deps.db,
            job,
            job["title"],
            job["year"],
            job["media_type"],
            job["season"],
            job["episode"],
        )
        results.append(
            {
                "id": job_id,
                "ok": ok,
                "message": message,
                "target": str(target) if target else None,
            }
        )
    return {"results": results}


@router.post("/scan")
def scan(request: Request):
    deps.current_session(request)
    deps.scanner.trigger()
    return {"ok": True, "message": "Scan requested"}
