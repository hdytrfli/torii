from __future__ import annotations

import json
import logging
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from . import apply, pipeline
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


@asynccontextmanager
async def lifespan(_: FastAPI):
    for directory in (cfg.watch_dir, cfg.library_dir, cfg.state_dir):
        directory.mkdir(parents=True, exist_ok=True)
    scanner.start()
    yield
    scanner.stop()


app = FastAPI(title="media-renamer", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=str(Path(__file__).resolve().parent / "static")), name="static")


def render(request: Request, name: str, **context):
    return templates.TemplateResponse(
        request=request,
        name=name,
        context={
            "request": request,
            "auth_enabled": bool(cfg.app_token),
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
    token = cfg.app_token
    path = request.url.path

    if not token or path in {"/login", "/api/health"} or path.startswith("/static"):
        return await call_next(request)

    if path.startswith("/api/"):
        header = request.headers.get("authorization", "")
        if header.lower().startswith("bearer ") and secrets.compare_digest(header[7:], token):
            return await call_next(request)
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    cookie = request.cookies.get("renamer_token")
    if cookie and secrets.compare_digest(cookie, token):
        return await call_next(request)

    return RedirectResponse("/login")


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


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    if not cfg.app_token:
        return _redirect("/")
    return render(request, "login.html")


@app.post("/login")
async def login(request: Request):
    if not cfg.app_token:
        return _redirect("/")
    form = await request.form()
    token = str(form.get("token", ""))
    if not secrets.compare_digest(token, cfg.app_token):
        return render(request, "login.html", msg="Invalid token.", kind="err")
    response = _redirect("/", "Signed in.")
    response.set_cookie(
        "renamer_token",
        cfg.app_token,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 30,
    )
    return response


@app.get("/logout")
def logout():
    response = _redirect("/login", "Signed out.")
    response.delete_cookie("renamer_token")
    return response


@app.get("/api/health")
def api_health():
    return {"ok": True}


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


class ApproveBody(BaseModel):
    title: str
    year: int | None = None
    media_type: str = "movie"
    season: int | None = None
    episode: int | None = None
    action: str | None = None


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
