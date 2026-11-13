from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from ..core import auth
from ..core.logging import DatabaseLogHandler, reset_actor, set_actor
from . import deps
from .routes import auth as auth_routes
from .routes import events, health, jobs, settings, shortcuts, users

OPEN_PATHS = {
    "/api/health",
    "/api/setup",
    "/api/setup/status",
    "/api/login",
    "/docs",
    "/openapi.json",
    "/redoc",
}


def _web_dist() -> Path | None:
    configured = os.getenv("WEB_DIST")
    if configured:
        candidate = Path(configured)
        return candidate if candidate.is_dir() else None
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "apps" / "web" / "dist"
        if candidate.is_dir():
            return candidate
    return None


@asynccontextmanager
async def lifespan(_: FastAPI):
    for directory in (*deps.cfg.watch_dirs, *deps.cfg.library_dirs, deps.cfg.state_dir):
        directory.mkdir(parents=True, exist_ok=True)
    deps.db.purge_expired_sessions()
    deps.ensure_default_admin()
    log_handler = DatabaseLogHandler(deps.db)
    app_logger = logging.getLogger("app")
    app_logger.setLevel(logging.INFO)
    app_logger.addHandler(log_handler)
    logging.getLogger(__name__).info("Torii application started")
    deps.operations.start()
    deps.scanner.start()
    yield
    deps.scanner.stop()
    deps.operations.stop()
    logging.getLogger("app").removeHandler(log_handler)


app = FastAPI(title="torii", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    if path in OPEN_PATHS or not path.startswith("/api/"):
        return await call_next(request)

    header = request.headers.get("authorization", "")
    token = header[7:].strip() if header.lower().startswith("bearer ") else None
    if not token and path.startswith("/api/events"):
        token = request.query_params.get("token")
    session = auth.get_session(deps.db, token)
    if session is None:
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    request.state.user = session
    request.state.token = token
    actor_token = set_actor(session.get("username"))
    try:
        return await call_next(request)
    finally:
        reset_actor(actor_token)


app.include_router(health.router)
app.include_router(auth_routes.router)
app.include_router(events.router)
app.include_router(jobs.router)
app.include_router(shortcuts.router)
app.include_router(settings.router)
app.include_router(users.router)


_dist = _web_dist()
if _dist is not None:
    assets = _dist / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        candidate = _dist / path
        if path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_dist / "index.html")
