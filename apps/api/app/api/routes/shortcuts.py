from __future__ import annotations

import logging
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request

from .. import deps
from ..schemas import ShortcutBody

router = APIRouter(prefix="/api", tags=["shortcuts"])
logger = logging.getLogger(__name__)


def _clean(body: ShortcutBody) -> tuple[str, str, bool]:
    title = body.title.strip()
    url = body.url.strip()

    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    if len(title) > 80:
        raise HTTPException(status_code=400, detail="Title must be 80 characters or fewer")

    parsed = urlparse(url)
    if not (
        (parsed.scheme in {"http", "https"} and parsed.netloc)
        or (url.startswith("/") and not url.startswith("//"))
    ):
        raise HTTPException(
            status_code=400,
            detail="URL must be an http(s) URL or an app-relative path",
        )
    return title, url, body.admin_only


def _json(shortcut: dict) -> dict:
    return {
        "id": shortcut["id"],
        "title": shortcut["title"],
        "url": shortcut["url"],
        "admin_only": bool(shortcut.get("admin_only")),
        "created_at": shortcut.get("created_at"),
        "updated_at": shortcut.get("updated_at"),
    }


@router.get("/shortcuts")
def list_shortcuts(request: Request):
    deps.current_session(request)
    return [_json(shortcut) for shortcut in deps.db.list_shortcuts()]


@router.post("/shortcuts")
def create_shortcut(request: Request, body: ShortcutBody):
    session = deps.require_admin(request)
    title, url, admin_only = _clean(body)
    shortcut = deps.db.create_shortcut(title, url, admin_only)
    logger.info(
        "Shortcut created",
        extra={
            "detail": {
                "id": shortcut["id"],
                "title": title,
                "url": url,
                "admin_only": admin_only,
                "username": session.get("username"),
            }
        },
    )
    return _json(shortcut)


@router.put("/shortcuts/{shortcut_id}")
def update_shortcut(request: Request, shortcut_id: int, body: ShortcutBody):
    session = deps.require_admin(request)
    if deps.db.get_shortcut(shortcut_id) is None:
        raise HTTPException(status_code=404, detail="Shortcut not found")
    title, url, admin_only = _clean(body)
    deps.db.update_shortcut(shortcut_id, title, url, admin_only)
    shortcut = deps.db.get_shortcut(shortcut_id)
    logger.info(
        "Shortcut updated",
        extra={
            "detail": {
                "id": shortcut_id,
                "title": title,
                "url": url,
                "admin_only": admin_only,
                "username": session.get("username"),
            }
        },
    )
    return _json(shortcut or {})


@router.delete("/shortcuts/{shortcut_id}")
def delete_shortcut(request: Request, shortcut_id: int):
    session = deps.require_admin(request)
    shortcut = deps.db.get_shortcut(shortcut_id)
    if shortcut is None:
        raise HTTPException(status_code=404, detail="Shortcut not found")
    deps.db.delete_shortcut(shortcut_id)
    logger.info(
        "Shortcut deleted",
        extra={
            "detail": {
                "id": shortcut_id,
                "title": shortcut.get("title"),
                "url": shortcut.get("url"),
                "username": session.get("username"),
            }
        },
    )
    return {"ok": True}
