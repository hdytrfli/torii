from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class LoginBody(BaseModel):
    username: str
    password: str


class SetupBody(BaseModel):
    username: str
    password: str


class JobUpdateBody(BaseModel):
    title: str
    year: int | None = None
    media_type: Literal["movie", "tv"] = "movie"
    season: int | None = None
    episode: int | None = None


class ApproveBody(BaseModel):
    title: str
    year: int | None = None
    media_type: Literal["movie", "tv"] = "movie"
    season: int | None = None
    episode: int | None = None
    action: Literal["move", "copy", "hardlink"] | None = None


class BulkBody(BaseModel):
    ids: list[int] = Field(min_length=1)
    action: Literal["approve", "reject", "undo"]


class SettingsBody(BaseModel):
    min_size_mb: float = Field(ge=0)
    extensions: list[str] = Field(min_length=1)
    movie_template: str
    tv_template: str
    action: Literal["move", "copy", "hardlink"]
    cleanup_empty_dirs: bool
    auto_apply: bool
    auto_apply_confidence: float = Field(ge=0, le=1)
    poll_interval: int = Field(ge=1)
    stable_seconds: int = Field(ge=0)
    queue_metadata_poll: int = Field(ge=1)
    queue_promotion_poll: int = Field(ge=1)
    queue_execution_poll: int = Field(ge=1)
    queue_revert_poll: int = Field(ge=1)


class UserCreateBody(BaseModel):
    username: str
    password: str
    is_admin: bool = False


class UserPasswordBody(BaseModel):
    password: str


class IdentifyBody(BaseModel):
    provider: Literal["tmdb", "imdb", "tvdb"]
    id: str
    media_type: Literal["movie", "tv"] | None = None


class LayoutPreviewBody(BaseModel):
    movie_template: str
    tv_template: str
    movie_title: str = "Spirited Away"
    movie_year: int | None = 2001
    show_title: str = "Dark"
    show_year: int | None = 2017
    season: int = 1
    episode: int = 1
