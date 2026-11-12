from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from ...domain import settings as settings_mod
from .. import deps
from ..schemas import SettingsBody

router = APIRouter(prefix="/api", tags=["settings"])


@router.get("/settings")
def get_settings(request: Request):
    deps.current_session(request)
    return deps.settings_payload()


@router.put("/settings")
def update_settings(request: Request, body: SettingsBody):
    deps.current_session(request)
    data = body.model_dump()
    form = {
        **data,
        "extensions": ",".join(data["extensions"]),
        "delete_source": str(data["delete_source"]).lower(),
        "cleanup_empty_dirs": str(data["cleanup_empty_dirs"]).lower(),
        "auto_apply": str(data["auto_apply"]).lower(),
        "dry_run": str(data["dry_run"]).lower(),
    }
    try:
        settings_mod.save(deps.db, form)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return deps.settings_payload()
