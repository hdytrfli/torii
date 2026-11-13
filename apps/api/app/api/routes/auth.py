from __future__ import annotations

import asyncio
import logging
import sqlite3

from fastapi import APIRouter, HTTPException, Request

from ...core import auth
from .. import deps
from ..schemas import LoginBody, SetupBody

router = APIRouter(prefix="/api", tags=["auth"])
logger = logging.getLogger(__name__)


@router.get("/setup/status")
def setup_status():
    return {"needs_setup": deps.db.count_users() == 0}


@router.post("/setup")
def setup(body: SetupBody):
    if deps.db.count_users() > 0:
        raise HTTPException(status_code=409, detail="Setup is already complete")

    username = auth.normalize_username(body.username)
    error = auth.validate_username(username) or auth.validate_password(body.password)
    if error:
        raise HTTPException(status_code=400, detail=error)

    try:
        user = deps.db.create_user(username, auth.hash_password(body.password), is_admin=True)
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Username already exists") from exc

    raw_token, session = auth.start_session(deps.db, user, deps.cfg.session_days)
    logger.info(
        "Initial administrator created",
        extra={
            "actor": username,
            "detail": {"username": username, "role": "administrator"},
        },
    )
    return deps.session_token_payload(raw_token, session)


@router.post("/login")
async def login(body: LoginBody):
    user = auth.authenticate(deps.db, body.username, body.password)
    if user is None:
        await asyncio.sleep(0.35)
        raise HTTPException(status_code=401, detail="Invalid username or password")
    raw_token, session = auth.start_session(deps.db, user, deps.cfg.session_days)
    logger.info(
        "User logged in",
        extra={
            "actor": user["username"],
            "detail": {
                "username": user["username"],
                "administrator": bool(user["is_admin"]),
            },
        },
    )
    return deps.session_token_payload(raw_token, session)


@router.post("/logout")
def logout(request: Request):
    session = deps.current_session(request)
    token = getattr(request.state, "token", None)
    if token:
        deps.db.delete_session(auth.hash_token(token))
    logger.info(
        "User logged out",
        extra={
            "detail": {
                "username": session.get("username"),
                "session_revoked": True,
            },
            "context": {"username": session.get("username")},
        },
    )
    return {"ok": True}


@router.get("/me")
def me(request: Request):
    session = deps.current_session(request)
    return {
        "id": session["user_id"],
        "username": session["username"],
        "is_admin": bool(session["is_admin"]),
        "expires_at": session["expires_at"],
    }
