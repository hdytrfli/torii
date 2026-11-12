from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, Request

from ...core import auth
from ...domain import guess, pipeline
from ...domain import settings as settings_mod
from ...services import apply
from ...services.providers import Candidate
from .. import deps
from ..schemas import ApproveBody, BulkBody, IdentifyBody

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


def _target(
    job: dict,
    title: str,
    year: int | None,
    media_type: str,
    season: int | None,
    episode: int | None,
) -> tuple[str | None, str | None]:
    value = apply.preview_target(
        deps.cfg,
        settings_mod.load(deps.db),
        job,
        title,
        year,
        media_type,
        season,
        episode,
    )
    if value.startswith("Invalid layout:"):
        return None, value
    return value, None


def _group(title: str, year: int | None, media_type: str, job: dict) -> tuple[str, str]:
    if media_type == "tv":
        return f"show:{title.casefold()}|{year or ''}", "show"
    if job.get("group_type") == "collection" and job.get("group_key"):
        return job["group_key"], "collection"
    return f"movie:{title.casefold()}|{year or ''}", "movie"


@router.post("/jobs/{job_id}/identify")
def identify(request: Request, job_id: int, body: IdentifyBody):
    deps.current_session(request)
    job = deps.db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not deps.jellyfin.enabled:
        raise HTTPException(status_code=400, detail="Jellyfin is not configured")

    media_type = body.media_type or job.get("media_type") or "movie"
    candidate = deps.jellyfin.lookup(body.provider, body.id, media_type)
    if candidate is None:
        raise HTTPException(status_code=404, detail=f"No {body.provider.upper()} match for {body.id}")

    title = candidate.title
    year = candidate.year
    season = job.get("season")
    episode = job.get("episode")
    target, error = _target(job, title, year, media_type, season, episode)
    group_key, group_type = _group(title, year, media_type, job)

    candidates = [candidate.to_dict()]
    existing = deps.db.job_json(job).get("candidates_json") or []
    for item in existing:
        if item.get("provider_id") != candidate.provider_id:
            candidates.append(item)

    deps.db.update_job(
        job_id,
        title=title,
        year=year,
        media_type=media_type,
        source="jellyfin",
        confidence=1.0,
        reason=f"Matched by {body.provider.upper()} ID {body.id}.",
        group_key=group_key,
        group_type=group_type,
        candidates_json=json.dumps(candidates, ensure_ascii=False),
        target_path=target,
        error=error,
    )
    return deps.db.job_json(deps.db.get_job(job_id) or job)


@router.post("/jobs/{job_id}/ai")
def ask_ai(request: Request, job_id: int):
    deps.current_session(request)
    job = deps.db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not deps.llm.enabled:
        raise HTTPException(status_code=400, detail="AI provider is not configured")

    path = Path(job["source_path"])
    if not path.exists():
        raise HTTPException(status_code=400, detail="Source file no longer exists")
    parsed = guess.parse(path)
    candidates = [
        Candidate(
            provider=item.get("provider") or "jellyfin",
            provider_id=item.get("provider_id"),
            title=item.get("title") or "",
            year=item.get("year"),
            overview=item.get("overview") or "",
            image=item.get("image"),
            kind=item.get("kind") or parsed.kind,
            score=float(item.get("score") or 0),
        )
        for item in (deps.db.job_json(job).get("candidates_json") or [])
    ]
    decision = deps.llm.normalize(path.stem, parsed, candidates)
    if decision is None:
        raise HTTPException(status_code=502, detail=deps.llm.last_error or "AI request failed")
    if not decision.get("title"):
        raise HTTPException(status_code=422, detail="AI returned no title")

    title = str(decision["title"])
    year = _int(decision.get("year")) or job.get("year")
    media_type = str(decision.get("media_type") or job.get("media_type") or "movie")
    if media_type not in {"movie", "tv"}:
        media_type = job.get("media_type") or "movie"
    season = _int(decision.get("season")) or job.get("season")
    episode = _int(decision.get("episode")) or job.get("episode")
    target, error = _target(job, title, year, media_type, season, episode)
    group_key, group_type = _group(title, year, media_type, job)

    deps.db.update_job(
        job_id,
        title=title,
        year=year,
        media_type=media_type,
        season=season,
        episode=episode,
        source="llm",
        confidence=max(float(job.get("confidence") or 0), 0.7),
        reason=decision.get("reason") or "AI requested manually.",
        group_key=group_key,
        group_type=group_type,
        target_path=target,
        error=error,
        llm_json=json.dumps(decision, ensure_ascii=False),
    )
    return deps.db.job_json(deps.db.get_job(job_id) or job)


@router.post("/jobs/{job_id}/undo")
def undo(request: Request, job_id: int):
    deps.current_session(request)
    job = deps.db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    ok, message = apply.undo_job(deps.cfg, settings_mod.load(deps.db), deps.db, job)
    if not ok:
        raise HTTPException(status_code=400, detail=message)
    return {"ok": True, "message": message, "job": deps.db.job_json(deps.db.get_job(job_id) or job)}


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
        if body.action == "undo":
            ok, message = apply.undo_job(deps.cfg, current_settings, deps.db, job)
            results.append({"id": job_id, "ok": ok, "message": message})
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
