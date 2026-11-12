from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Request

from ..core import auth
from ..core.config import Config
from ..core.db import DB
from ..domain import settings as settings_mod
from ..services.operations import OperationQueue
from ..services.providers import JellyfinProvider, LLM
from ..services.scanner import Scanner
from .grouping import group_jobs


cfg = Config.load()
db = DB(cfg.db_path)
jellyfin = JellyfinProvider(cfg.jellyfin_url, cfg.jellyfin_api_key)
llm = LLM(cfg.llm_base_url, cfg.llm_api_key, cfg.llm_model)
operations = OperationQueue(cfg, db)
scanner = Scanner(cfg, db, jellyfin, llm, enqueue_apply=operations.enqueue_auto)


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
    eligible = blocked = below = 0
    for job in db.list_jobs(limit=1000):
        if job.get("status") not in {"needs_review", "ready"}:
            continue
        if float(job.get("confidence") or 0) < current.auto_apply_confidence:
            below += 1
        elif (
            job.get("blocked_reason")
            or job.get("error")
            or not job.get("auto_apply_eligible", 1)
        ):
            blocked += 1
        else:
            eligible += 1
    return {
        "min_size_mb": current.min_size_mb,
        "extensions": list(current.extensions),
        "movie_template": current.movie_template,
        "tv_template": current.tv_template,
        "action": current.action,
        "cleanup_empty_dirs": current.cleanup_empty_dirs,
        "auto_apply": current.auto_apply,
        "auto_apply_confidence": current.auto_apply_confidence,
        "auto_apply_eligible": eligible,
        "auto_apply_blocked": blocked,
        "auto_apply_below_threshold": below,
        "poll_interval": current.poll_interval,
        "stable_seconds": current.stable_seconds,
        "movie_preview": settings_mod.preview(current.movie_template),
        "tv_preview": settings_mod.preview(current.tv_template),
    }


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
