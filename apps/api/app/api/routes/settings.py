from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request

from ...domain import naming
from ...domain import settings as settings_mod
from .. import deps
from ..schemas import LayoutPreviewBody, SettingsBody

router = APIRouter(prefix="/api", tags=["settings"])
logger = logging.getLogger(__name__)


@router.get("/settings")
def get_settings(request: Request):
    deps.current_session(request)
    return deps.settings_payload()


@router.put("/settings")
def update_settings(request: Request, body: SettingsBody):
    session = deps.current_session(request)
    data = body.model_dump()
    form = {
        **data,
        "extensions": ",".join(data["extensions"]),
        "cleanup_empty_dirs": str(data["cleanup_empty_dirs"]).lower(),
        "auto_apply": str(data["auto_apply"]).lower(),
        "queue_metadata_poll": str(data["queue_metadata_poll"]),
        "queue_promotion_poll": str(data["queue_promotion_poll"]),
        "queue_execution_poll": str(data["queue_execution_poll"]),
        "queue_revert_poll": str(data["queue_revert_poll"]),
    }
    try:
        settings_mod.save(deps.db, form)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    logger.info(
        "Settings updated",
        extra={
            "detail": {
                "username": session.get("username"),
                "action": data["action"],
                "auto_apply": data["auto_apply"],
                "auto_apply_confidence": data["auto_apply_confidence"],
                "extensions": data["extensions"],
                "movie_template": data["movie_template"],
                "tv_template": data["tv_template"],
                "queue_polls": {
                    "metadata": data["queue_metadata_poll"],
                    "promotion": data["queue_promotion_poll"],
                    "execution": data["queue_execution_poll"],
                    "revert": data["queue_revert_poll"],
                },
            },
            "context": {
                "username": session.get("username"),
                "action": data["action"],
                "auto_apply": data["auto_apply"],
            },
        },
    )
    deps.scanner.trigger()
    return deps.settings_payload()


@router.post("/layout/preview")
def preview_layout(request: Request, body: LayoutPreviewBody):
    deps.current_session(request)
    try:
        settings_mod.validate_template(body.movie_template, "Movie layout")
        settings_mod.validate_template(body.tv_template, "Show layout")
        movie = naming.target_for_movie(
            deps.cfg.movie_library_dir,
            body.movie_template,
            body.movie_title,
            body.movie_year,
            ".mkv",
        )
        show = naming.target_for_show(
            deps.cfg.show_library_dir,
            body.tv_template,
            body.show_title,
            body.show_year,
            body.season,
            body.episode,
            ".mkv",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"movie": str(movie), "shows": str(show)}
