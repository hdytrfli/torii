from __future__ import annotations

import asyncio
import logging
import secrets
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from . import apply, auth, pipeline
from . import settings as settings_mod
from .config import Config
from .db import DB
from .providers import JellyfinProvider, LLM
from .scanner import Scanner

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

cfg = Config.from_env()
db = DB(cfg.db_path)
jellyfin = JellyfinProvider(cfg.jellyfin_url, cfg.jellyfin_api_key)
llm = LLM(cfg.llm_base_url, cfg.llm_api_key, cfg.llm_model)
scanner = Scanner(cfg, db, jellyfin, llm)

templates = Jinja2Templates(directory=str(Path(__file__).resolve().parent / "templates"))
templates.env.filters["basename"] = lambda value: Path(str(value)).name
templates.env.filters["pct"] = lambda value: f"{float(value or 0) * 100:.0f}%"

OPEN_PATHS = {"/login", "/setup", "/api/login", "/api/health"}


@asynccontextmanager
async def lifespan(_: FastAPI):
    for directory in (cfg.watch_dir, cfg.library_dir, cfg.state_dir):
        directory.mkdir(parents=True, exist_ok=True)
    db.purge_expired_sessions()
    scanner.start()
    yield
    scanner.stop()


app = FastAPI(title="media-renamer", lifespan=lifespan)
app.mount(
    "/static",
    StaticFiles(directory=str(Path(__file__).resolve().parent / "static")),
    name="static",
)


def render(request: Request, name: str, **context):
    session = getattr(request.state, "session", None)
    user = getattr(request.state, "user", None)
    return templates.TemplateResponse(
        request=request,
        name=name,
        context={
            "request": request,
            "current_user": user,
            "csrf_token": session["csrf_token"] if session else "",
            **context,
        },
    )


def _redirect(path: str, message: str | None = None, kind: str = "ok") -> RedirectResponse:
    if message:
        path = f"{path}?msg={quote(message)}&kind={kind}"
    return RedirectResponse(path, status_code=303)


def _int_or_none(value) -> int | None:
    try:
        text = str(value or "").strip()
        return int(text) if text else None
    except (TypeError, ValueError):
        return None


def _bearer(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        value = header[7:].strip()
        return value or None
    return None


def _secure_cookie(request: Request) -> bool:
    forwarded = request.headers.get("x-forwarded-proto", "").split(",")[0].strip().lower()
    return request.url.scheme == "https" or forwarded == "https"


def _set_session_cookie(response: RedirectResponse, token: str, request: Request) -> None:
    response.set_cookie(
        auth.SESSION_COOKIE,
        token,
        max_age=cfg.session_days * 86400,
        httponly=True,
        samesite="lax",
        secure=_secure_cookie(request),
        path="/",
    )


def _clear_session_cookie(response: RedirectResponse) -> None:
    response.delete_cookie(auth.SESSION_COOKIE, path="/")


def _job_context(job: dict) -> dict:
    data = db.job_json(job)
    candidates = data.get("candidates_json") or []
    parsed = data.get("parsed_json") or {}
    settings = settings_mod.load(db)

    preview = ""
    if data.get("title"):
        preview = apply.preview_target(
            cfg,
            settings,
            data,
            data["title"],
            data.get("year"),
            data.get("media_type") or "movie",
            data.get("season"),
            data.get("episode"),
        )

    return {
        "job": data,
        "candidates": candidates,
        "parsed": parsed,
        "preview": preview,
        "settings": settings,
    }


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path

    if path.startswith("/static") or path in OPEN_PATHS:
        return await call_next(request)

    if path.startswith("/api/"):
        session = auth.get_session(db, _bearer(request))
        if session is None:
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)
        request.state.session = session
        request.state.user = session
        return await call_next(request)

    if db.count_users() == 0:
        return RedirectResponse("/setup", status_code=303)

    token = request.cookies.get(auth.SESSION_COOKIE)
    session = auth.get_session(db, token)
    if session is None:
        response = RedirectResponse("/login", status_code=303)
        _clear_session_cookie(response)
        return response

    request.state.session = session
    request.state.user = session

    if request.method == "POST":
        form = await request.form()
        csrf = str(form.get("_csrf", ""))
        if not csrf or not secrets.compare_digest(csrf, session["csrf_token"]):
            return HTMLResponse("Invalid CSRF token. Reload the page and try again.", status_code=400)

    return await call_next(request)


# setup / login / account ------------------------------------------------


@app.get("/setup", response_class=HTMLResponse)
def setup_page(request: Request):
    if db.count_users() > 0:
        return _redirect("/login")
    return render(
        request,
        "setup.html",
        msg=request.query_params.get("msg"),
        kind=request.query_params.get("kind", "ok"),
    )


@app.post("/setup")
async def setup_save(request: Request):
    if db.count_users() > 0:
        return _redirect("/login")

    form = await request.form()
    username = auth.normalize_username(str(form.get("username", "")))
    password = str(form.get("password", ""))
    confirm = str(form.get("confirm_password", ""))

    error = auth.validate_username(username) or auth.validate_password(password)
    if not error and password != confirm:
        error = "Passwords do not match."
    if error:
        return render(request, "setup.html", msg=error, kind="err")

    try:
        user = db.create_user(username, auth.hash_password(password), is_admin=True)
    except sqlite3.IntegrityError:
        return render(request, "setup.html", msg="That username already exists.", kind="err")

    raw_token, _ = auth.start_session(db, user, cfg.session_days)
    response = _redirect("/", "Administrator account created.")
    _set_session_cookie(response, raw_token, request)
    return response


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    if db.count_users() == 0:
        return _redirect("/setup")
    if auth.get_session(db, request.cookies.get(auth.SESSION_COOKIE)):
        return _redirect("/")
    return render(
        request,
        "login.html",
        msg=request.query_params.get("msg"),
        kind=request.query_params.get("kind", "ok"),
    )


@app.post("/login")
async def login_save(request: Request):
    if db.count_users() == 0:
        return _redirect("/setup")

    form = await request.form()
    username = str(form.get("username", ""))
    password = str(form.get("password", ""))
    user = auth.authenticate(db, username, password)
    if user is None:
        await asyncio.sleep(0.35)
        return render(request, "login.html", msg="Invalid username or password.", kind="err")

    raw_token, _ = auth.start_session(db, user, cfg.session_days)
    response = _redirect("/")
    _set_session_cookie(response, raw_token, request)
    return response


@app.post("/logout")
def logout(request: Request):
    token = request.cookies.get(auth.SESSION_COOKIE)
    if token:
        db.delete_session(auth.hash_token(token))
    response = _redirect("/login", "Signed out.")
    _clear_session_cookie(response)
    return response


@app.get("/account", response_class=HTMLResponse)
def account_page(request: Request):
    return render(
        request,
        "account.html",
        msg=request.query_params.get("msg"),
        kind=request.query_params.get("kind", "ok"),
    )


@app.post("/account/password")
async def account_password(request: Request):
    user = request.state.user
    stored = db.get_user(int(user["user_id"]))
    form = await request.form()
    current = str(form.get("current_password", ""))
    new_password = str(form.get("new_password", ""))
    confirm = str(form.get("confirm_password", ""))

    if stored is None or not auth.verify_password(current, stored["password_hash"]):
        return render(request, "account.html", msg="Current password is incorrect.", kind="err")

    error = auth.validate_password(new_password)
    if not error and new_password != confirm:
        error = "New passwords do not match."
    if error:
        return render(request, "account.html", msg=error, kind="err")

    db.update_user_password(int(user["user_id"]), auth.hash_password(new_password))
    db.delete_user_sessions(int(user["user_id"]))
    raw_token, _ = auth.start_session(db, stored, cfg.session_days)
    response = _redirect("/account", "Password changed. Other sessions were signed out.")
    _set_session_cookie(response, raw_token, request)
    return response


# user administration ----------------------------------------------------


def _admin_guard(request: Request):
    if not request.state.user.get("is_admin"):
        return _redirect("/", "Administrator access is required.", "err")
    return None


@app.get("/users", response_class=HTMLResponse)
def users_page(request: Request):
    guard = _admin_guard(request)
    if guard:
        return guard
    return render(
        request,
        "users.html",
        users=db.list_users(),
        msg=request.query_params.get("msg"),
        kind=request.query_params.get("kind", "ok"),
    )


@app.post("/users")
async def users_create(request: Request):
    guard = _admin_guard(request)
    if guard:
        return guard

    form = await request.form()
    username = auth.normalize_username(str(form.get("username", "")))
    password = str(form.get("password", ""))
    confirm = str(form.get("confirm_password", ""))
    is_admin = bool(form.get("is_admin"))

    error = auth.validate_username(username) or auth.validate_password(password)
    if not error and password != confirm:
        error = "Passwords do not match."
    if error:
        return _redirect("/users", error, "err")

    try:
        db.create_user(username, auth.hash_password(password), is_admin=is_admin)
    except sqlite3.IntegrityError:
        return _redirect("/users", "That username already exists.", "err")

    return _redirect("/users", "User created.")


@app.post("/users/{user_id}/password")
async def users_password(request: Request, user_id: int):
    guard = _admin_guard(request)
    if guard:
        return guard
    if user_id == int(request.state.user["user_id"]):
        return _redirect("/account", "Use the account page to change your own password.", "err")

    target = db.get_user(user_id)
    if target is None:
        return _redirect("/users", "User not found.", "err")

    form = await request.form()
    password = str(form.get("password", ""))
    confirm = str(form.get("confirm_password", ""))
    error = auth.validate_password(password)
    if not error and password != confirm:
        error = "Passwords do not match."
    if error:
        return _redirect("/users", error, "err")

    db.update_user_password(user_id, auth.hash_password(password))
    db.delete_user_sessions(user_id)
    return _redirect("/users", f"Password reset for {target['username']}.")


@app.post("/users/{user_id}/delete")
def users_delete(request: Request, user_id: int):
    guard = _admin_guard(request)
    if guard:
        return guard
    if user_id == int(request.state.user["user_id"]):
        return _redirect("/users", "You cannot delete your own account.", "err")

    target = db.get_user(user_id)
    if target is None:
        return _redirect("/users", "User not found.", "err")
    if target["is_admin"] and db.count_admins() <= 1:
        return _redirect("/users", "At least one administrator is required.", "err")

    db.delete_user(user_id)
    return _redirect("/users", f"Deleted {target['username']}.")


# jobs / settings --------------------------------------------------------


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    status = request.query_params.get("status", "needs_review")
    jobs = db.list_jobs(status)
    return render(
        request,
        "index.html",
        jobs=jobs,
        status=status,
        stats=db.stats(),
        msg=request.query_params.get("msg"),
        kind=request.query_params.get("kind", "ok"),
    )


@app.get("/jobs/{job_id}", response_class=HTMLResponse)
def job_detail(request: Request, job_id: int):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return render(
        request,
        "job.html",
        **_job_context(job),
        msg=request.query_params.get("msg"),
        kind=request.query_params.get("kind", "ok"),
    )


@app.post("/jobs/{job_id}/candidate")
async def use_candidate(request: Request, job_id: int):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    form = await request.form()
    candidates = db.job_json(job).get("candidates_json") or []
    try:
        candidate = candidates[int(str(form.get("candidate_id", "")))]
    except (ValueError, IndexError):
        return _redirect(f"/jobs/{job_id}", "Candidate not found.", "err")

    db.update_job(
        job_id,
        title=candidate.get("title"),
        year=candidate.get("year"),
        media_type=candidate.get("kind") or job["media_type"],
    )
    return _redirect(f"/jobs/{job_id}", "Candidate applied.")


@app.post("/jobs/{job_id}/approve")
async def approve(request: Request, job_id: int):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    form = await request.form()
    title = str(form.get("title", "")).strip()
    if not title:
        return _redirect(f"/jobs/{job_id}", "Title is required.", "err")

    media_type = str(form.get("media_type", "movie"))
    action = str(form.get("action") or "") or None
    settings = settings_mod.load(db)
    ok, message, _ = apply.apply_job(
        cfg,
        settings,
        db,
        job,
        title,
        _int_or_none(form.get("year")),
        media_type,
        _int_or_none(form.get("season")),
        _int_or_none(form.get("episode")),
        action,
    )
    return _redirect(f"/jobs/{job_id}", message, "ok" if ok else "err")


@app.post("/jobs/{job_id}/reject")
def reject(job_id: int):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.update_job(job_id, status="rejected", error=None)
    return _redirect(f"/jobs/{job_id}", "Job rejected.")


@app.post("/jobs/{job_id}/retry")
def retry(job_id: int):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    path = Path(job["source_path"])
    if not path.exists():
        return _redirect(f"/jobs/{job_id}", "Source file no longer exists.", "err")
    settings = settings_mod.load(db)
    pipeline.analyze(cfg, settings, db, path, jellyfin, llm)
    return _redirect(f"/jobs/{job_id}", "Re-analyzed.")


@app.post("/scan")
def scan_now():
    scanner.trigger()
    return _redirect("/", "Scan requested.")


@app.get("/settings", response_class=HTMLResponse)
def settings_page(request: Request):
    settings = settings_mod.load(db)
    return render(
        request,
        "settings.html",
        settings=settings,
        movie_preview=settings_mod.preview(settings.movie_template),
        tv_preview=settings_mod.preview(settings.tv_template),
        msg=request.query_params.get("msg"),
        kind=request.query_params.get("kind", "ok"),
    )


@app.post("/settings")
async def settings_save(request: Request):
    form = await request.form()
    values = {key: str(value) for key, value in form.items()}
    try:
        settings_mod.save(db, values)
    except ValueError as exc:
        settings = settings_mod.load(db)
        return render(
            request,
            "settings.html",
            settings=settings,
            movie_preview=settings_mod.preview(settings.movie_template),
            tv_preview=settings_mod.preview(settings.tv_template),
            msg=str(exc),
            kind="err",
        )
    return _redirect("/settings", "Settings saved.")


# JSON API ---------------------------------------------------------------


@app.get("/api/health")
def api_health():
    return {"ok": True}


class LoginBody(BaseModel):
    username: str
    password: str


class ApproveBody(BaseModel):
    title: str
    year: int | None = None
    media_type: str = "movie"
    season: int | None = None
    episode: int | None = None
    action: str | None = None


@app.post("/api/login")
async def api_login(body: LoginBody):
    user = auth.authenticate(db, body.username, body.password)
    if user is None:
        await asyncio.sleep(0.35)
        raise HTTPException(status_code=401, detail="Invalid username or password")
    raw_token, session = auth.start_session(db, user, cfg.session_days)
    return {
        "token": raw_token,
        "token_type": "bearer",
        "expires_at": session["expires_at"],
        "user": user,
    }


@app.post("/api/logout")
def api_logout(request: Request):
    token = _bearer(request)
    if token:
        db.delete_session(auth.hash_token(token))
    return {"ok": True}


@app.get("/api/me")
def api_me(request: Request):
    user = request.state.user
    return {
        "id": user["user_id"],
        "username": user["username"],
        "is_admin": bool(user["is_admin"]),
        "expires_at": user["expires_at"],
    }


@app.get("/api/stats")
def api_stats():
    return db.stats()


@app.get("/api/jobs")
def api_jobs(status: str = "all"):
    return [db.job_json(job) for job in db.list_jobs(status)]


@app.get("/api/jobs/{job_id}")
def api_job(job_id: int):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return db.job_json(job)


@app.post("/api/jobs/{job_id}/approve")
def api_approve(job_id: int, body: ApproveBody):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    settings = settings_mod.load(db)
    ok, message, target = apply.apply_job(
        cfg,
        settings,
        db,
        job,
        body.title,
        body.year,
        body.media_type,
        body.season,
        body.episode,
        body.action,
    )
    return {"ok": ok, "message": message, "target": str(target) if target else None}


@app.post("/api/jobs/{job_id}/reject")
def api_reject(job_id: int):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.update_job(job_id, status="rejected", error=None)
    return {"ok": True}


@app.post("/api/jobs/{job_id}/retry")
def api_retry(job_id: int):
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    path = Path(job["source_path"])
    if not path.exists():
        raise HTTPException(status_code=400, detail="Source file no longer exists")
    settings = settings_mod.load(db)
    pipeline.analyze(cfg, settings, db, path, jellyfin, llm)
    return {"ok": True, "job": db.job_json(db.get_job(job_id) or {})}


@app.post("/api/scan")
def api_scan():
    scanner.trigger()
    return {"ok": True, "message": "Scan requested"}
