from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    return value if value not in (None, "") else default


def _bool(name: str, default: bool) -> bool:
    value = _env(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Config:
    watch_dir: Path
    library_dir: Path
    state_dir: Path
    host: str
    port: int
    log_level: str
    app_token: str | None
    jellyfin_url: str | None
    jellyfin_api_key: str | None
    llm_base_url: str | None
    llm_api_key: str | None
    llm_model: str | None
    notify_url: str | None
    post_action_cmd: str | None

    @property
    def db_path(self) -> Path:
        return self.state_dir / "media-renamer.db"

    @classmethod
    def from_env(cls) -> Config:
        return cls(
            watch_dir=Path(_env("WATCH_DIR", "/downloads") or "/downloads"),
            library_dir=Path(_env("LIBRARY_DIR", "/library") or "/library"),
            state_dir=Path(_env("STATE_DIR", "/data") or "/data"),
            host=_env("HOST", "0.0.0.0") or "0.0.0.0",
            port=int(_env("PORT", "8000") or "8000"),
            log_level=(_env("LOG_LEVEL", "INFO") or "INFO").upper(),
            app_token=_env("APP_TOKEN"),
            jellyfin_url=(_env("JELLYFIN_URL") or "").rstrip("/") or None,
            jellyfin_api_key=_env("JELLYFIN_API_KEY"),
            llm_base_url=_env("LLM_BASE_URL"),
            llm_api_key=_env("LLM_API_KEY"),
            llm_model=_env("LLM_MODEL"),
            notify_url=_env("NOTIFY_URL"),
            post_action_cmd=_env("POST_ACTION_CMD"),
        )
