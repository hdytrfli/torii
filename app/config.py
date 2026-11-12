from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from . import deployment


def _secret(name: str) -> str | None:
    value = os.getenv(name)
    return value if value not in (None, "") else None


def _optional_url(name: str) -> str | None:
    value = _secret(name)
    if value is None:
        return None
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(f"{name} must be an http(s) URL")
    return value.rstrip("/")


@dataclass(frozen=True)
class Config:
    movie_watch_dir: Path
    show_watch_dir: Path
    movie_library_dir: Path
    show_library_dir: Path
    state_dir: Path
    host: str
    port: int
    log_level: str
    session_days: int
    jellyfin_url: str | None
    jellyfin_api_key: str | None
    llm_base_url: str | None
    llm_api_key: str | None
    llm_model: str | None
    notify_url: str | None
    post_action_cmd: str | None

    @property
    def db_path(self) -> Path:
        return self.state_dir / "torii.db"

    @property
    def watch_dirs(self) -> tuple[Path, Path]:
        return self.movie_watch_dir, self.show_watch_dir

    @property
    def library_dirs(self) -> tuple[Path, Path]:
        return self.movie_library_dir, self.show_library_dir

    @classmethod
    def load(cls) -> Config:
        data = deployment.load()
        llm_base_url = _optional_url("LLM_BASE_URL")
        llm_model = _secret("LLM_MODEL")
        if llm_base_url and not llm_model:
            raise ValueError("LLM_MODEL is required when LLM_BASE_URL is set")
        return cls(
            movie_watch_dir=Path(data["paths"]["watch"]["movies"]),
            show_watch_dir=Path(data["paths"]["watch"]["shows"]),
            movie_library_dir=Path(data["paths"]["library"]["movies"]),
            show_library_dir=Path(data["paths"]["library"]["shows"]),
            state_dir=Path(data["paths"]["state"]),
            host=data["server"]["host"],
            port=int(data["server"]["port"]),
            log_level=data["server"]["log_level"],
            session_days=int(data["session_days"]),
            jellyfin_url=_optional_url("JELLYFIN_URL"),
            jellyfin_api_key=_secret("JELLYFIN_API_KEY"),
            llm_base_url=llm_base_url,
            llm_api_key=_secret("LLM_API_KEY"),
            llm_model=llm_model,
            notify_url=_secret("NOTIFY_URL"),
            post_action_cmd=_secret("POST_ACTION_CMD"),
        )
