from __future__ import annotations

import logging
import sqlite3

from fastapi import APIRouter, HTTPException, Request

from ...core import auth
from .. import deps
from ..schemas import UserCreateBody, UserPasswordBody

router = APIRouter(prefix="/api", tags=["users"])
logger = logging.getLogger(__name__)


@router.get("/users")
def list_users(request: Request):
    deps.require_admin(request)
    return [_public_user(user) for user in deps.db.list_users()]


@router.post("/users")
def create_user(request: Request, body: UserCreateBody):
    deps.require_admin(request)
    username = auth.normalize_username(body.username)
    error = auth.validate_username(username) or auth.validate_password(body.password)
    if error:
        raise HTTPException(status_code=400, detail=error)
    try:
        user = deps.db.create_user(
            username, auth.hash_password(body.password), is_admin=body.is_admin
        )
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Username already exists") from exc
    logger.info(
        "User created",
        extra={
            "detail": {"username": username, "administrator": body.is_admin},
            "context": {"username": username, "is_admin": body.is_admin},
        },
    )
    return _public_user(user)


@router.post("/users/{user_id}/password")
def reset_password(request: Request, user_id: int, body: UserPasswordBody):
    current = deps.require_admin(request)
    if user_id == int(current["user_id"]):
        raise HTTPException(status_code=400, detail="Use /api/account/password for yourself")
    error = auth.validate_password(body.password)
    if error:
        raise HTTPException(status_code=400, detail=error)
    target = deps.db.get_user(user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    deps.db.update_user_password(user_id, auth.hash_password(body.password))
    deps.db.delete_user_sessions(user_id)
    logger.info(
        "User password reset",
        extra={
            "detail": {
                "username": target["username"],
                "sessions_revoked": True,
            },
            "context": {"user_id": user_id},
        },
    )
    return {"ok": True}


@router.delete("/users/{user_id}")
def delete_user(request: Request, user_id: int):
    current = deps.require_admin(request)
    if user_id == int(current["user_id"]):
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    target = deps.db.get_user(user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target["is_admin"] and deps.db.count_admins() <= 1:
        raise HTTPException(status_code=400, detail="At least one administrator is required")
    deps.db.delete_user(user_id)
    logger.info(
        "User deleted",
        extra={
            "detail": {
                "username": target["username"],
                "administrator": bool(target["is_admin"]),
            },
            "context": {"user_id": user_id, "username": target["username"]},
        },
    )
    return {"ok": True}


@router.post("/account/password")
def change_password(request: Request, body: UserPasswordBody):
    current = deps.current_session(request)
    stored = deps.db.get_user(int(current["user_id"]))
    if stored is None:
        raise HTTPException(status_code=404, detail="User not found")
    error = auth.validate_password(body.password)
    if error:
        raise HTTPException(status_code=400, detail=error)
    deps.db.update_user_password(int(current["user_id"]), auth.hash_password(body.password))
    deps.db.delete_user_sessions(int(current["user_id"]))
    user = deps.db.get_user(int(current["user_id"]))
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    logger.info(
        "Password changed",
        extra={
            "detail": {
                "username": user["username"],
                "sessions_revoked": True,
            },
            "context": {"user_id": user["id"]},
        },
    )
    raw_token, session = auth.start_session(deps.db, user, deps.cfg.session_days)
    return deps.session_token_payload(raw_token, session)


def _public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "username": user["username"],
        "is_admin": bool(user["is_admin"]),
        "created_at": user.get("created_at"),
    }
