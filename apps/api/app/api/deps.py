from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Request

from ..core import auth
from ..core.config import Config
from ..core.db import DB
from ..domain import settings as settings_mod
from ..services.providers import JellyfinProvider, LLM
from ..services.scanner import Scanner


cfg = Config.load()
db = DB(cfg.db_path)
jellyfin = JellyfinProvider(cfg.jellyfin_url, cfg.jellyfin_api_key)
llm = LLM(cfg.llm_base_url, cfg.llm_api_key, cfg.llm_model)
scanner = Scanner(cfg, db, jellyfin, llm)


def ensure_default_admin() -> None:
    if db.count_users() > 0 or not cfg.default_username or not cfg.default_password:
        return
    username = auth.normalize_username(cfg.default_username)
    if auth.validate_username(username):
        return
    db.create_user(username, auth.hash_password(cfg.default_password), is_admin=True)


def current_session(request: Request) -> dict[str, Any]:
    session = getattr(request.state, "user", None)
    if not session:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return session


def require_admin(request: Request) -> dict[str, Any]:
    session = current_session(request)
    if not session.get("is_admin"):
        raise HTTPException(status_code=403, detail="Administrator access required")
    return session


def settings_payload() -> dict[str, Any]:
    current = settings_mod.load(db)
    return {
        "min_size_mb": current.min_size_mb,
        "extensions": list(current.extensions),
        "movie_template": current.movie_template,
        "tv_template": current.tv_template,
        "action": current.action,
        "delete_source": current.delete_source,
        "cleanup_empty_dirs": current.cleanup_empty_dirs,
        "auto_apply": current.auto_apply,
        "auto_apply_confidence": current.auto_apply_confidence,
        "poll_interval": current.poll_interval,
        "stable_seconds": current.stable_seconds,
        "dry_run": current.dry_run,
        "movie_preview": settings_mod.preview(current.movie_template),
        "tv_preview": settings_mod.preview(current.tv_template),
    }


def group_jobs(jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for job in jobs:
        key = job.get("group_key") or f"job:{job['id']}"
        grouped.setdefault(key, []).append(job)

    result = []
    for key, group in grouped.items():
        first = group[0]
        group_type = first.get("group_type") or "movie"
        title = first.get("title") or "Unknown"
        year = first.get("year")
        if group_type == "collection":
            label = key.split(":", 1)[-1].split("/")[-1] or title
        else:
            label = f"{title} ({year})" if year else title

        sources = [item.get("source") for item in group if item.get("source")]
        result.append(
            {
                "key": key,
                "type": group_type,
                "label": label,
                "counts": _counts(group),
                "total": len(group),
                "confidence": min(
                    (float(item.get("confidence") or 0) for item in group),
                    default=0,
                ),
                "source": max(set(sources), key=sources.count) if sources else None,
                "jobs": [db.job_json(item) for item in group],
            }
        )

    result.sort(key=lambda item: item["jobs"][0].get("updated_at") or "", reverse=True)
    return result


def _counts(jobs: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for job in jobs:
        status = job.get("status") or "unknown"
        counts[status] = counts.get(status, 0) + 1
    return counts


def session_token_payload(raw_token: str, session: dict[str, Any]) -> dict[str, Any]:
    return {
        "token": raw_token,
        "token_type": "bearer",
        "expires_at": session["expires_at"],
        "user": auth.public_user(
            {
                "id": session["user_id"],
                "username": session["username"],
                "is_admin": session["is_admin"],
            }
        ),
    }
