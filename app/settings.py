from __future__ import annotations

import os
from dataclasses import dataclass
from string import Formatter

ACTIONS = {"move", "copy", "hardlink"}
PLACEHOLDERS = {
    "title",
    "year",
    "folder",
    "season",
    "episode",
    "episode_tag",
    "quality",
    "source",
    "codec",
    "group",
    "ext",
}


def _env(name: str, default: str) -> str:
    value = os.getenv(name)
    return value if value not in (None, "") else default


def defaults() -> dict[str, str]:
    return {
        "min_size_mb": _env("MIN_SIZE_MB", "100"),
        "extensions": _env("EXTENSIONS", "mkv,mp4,avi,mov,m4v,webm,ts,m2ts"),
        "movie_template": _env("MOVIE_TEMPLATE", "{folder}/{folder}"),
        "tv_template": _env("TV_TEMPLATE", "{folder}/Season {season:02d}/{title} - {episode_tag}"),
        "action": _env("ACTION", "move"),
        "delete_source": _env("DELETE_SOURCE", "false"),
        "cleanup_empty_dirs": _env("CLEANUP_EMPTY_DIRS", "true"),
        "auto_apply": _env("AUTO_APPLY", "false"),
        "auto_apply_confidence": _env("AUTO_APPLY_CONFIDENCE", "0.85"),
        "poll_interval": _env("POLL_INTERVAL", "60"),
        "stable_seconds": _env("STABLE_SECONDS", "120"),
        "dry_run": _env("DRY_RUN", "false"),
    }


def _bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _extensions(value: str) -> tuple[str, ...]:
    items = [item.strip().lower().lstrip(".") for item in value.split(",")]
    items = [item for item in items if item]
    if not items:
        raise ValueError("At least one file extension is required.")
    return tuple(dict.fromkeys(items))


def validate_template(template: str, label: str) -> None:
    if not template.strip():
        raise ValueError(f"{label} cannot be empty.")
    if template.startswith(("/", "\\")) or ".." in template:
        raise ValueError(f"{label} must be a relative path without '..'.")

    try:
        parsed = list(Formatter().parse(template))
    except ValueError as exc:
        raise ValueError(f"{label} is not a valid template: {exc}") from exc

    for _, field, _, _ in parsed:
        if field is None:
            continue
        if field not in PLACEHOLDERS:
            raise ValueError(
                f"{label} uses unknown placeholder {{{field}}}. "
                f"Allowed: {', '.join(sorted(PLACEHOLDERS))}."
            )


@dataclass(frozen=True)
class Settings:
    min_size_mb: float
    extensions: tuple[str, ...]
    movie_template: str
    tv_template: str
    action: str
    delete_source: bool
    cleanup_empty_dirs: bool
    auto_apply: bool
    auto_apply_confidence: float
    poll_interval: int
    stable_seconds: int
    dry_run: bool

    @property
    def extension_set(self) -> set[str]:
        return set(self.extensions)


def _float(raw: dict[str, str], key: str, fallback: float) -> float:
    try:
        return float(raw.get(key, fallback))
    except (TypeError, ValueError):
        return fallback


def _int(raw: dict[str, str], key: str, fallback: int) -> int:
    try:
        return int(float(raw.get(key, fallback)))
    except (TypeError, ValueError):
        return fallback


def _settings_from_raw(raw: dict[str, str]) -> Settings:
    base = defaults()
    action = (raw.get("action") or base["action"]).lower()
    if action not in ACTIONS:
        action = "move"

    try:
        extensions = _extensions(raw.get("extensions") or base["extensions"])
    except ValueError:
        extensions = _extensions(base["extensions"])

    movie_template = raw.get("movie_template") or base["movie_template"]
    tv_template = raw.get("tv_template") or base["tv_template"]
    for key, label in (("movie_template", "Movie layout"), ("tv_template", "Show layout")):
        value = movie_template if key == "movie_template" else tv_template
        try:
            validate_template(value, label)
        except ValueError:
            value = base[key]
        if key == "movie_template":
            movie_template = value
        else:
            tv_template = value

    return Settings(
        min_size_mb=max(0.0, _float(raw, "min_size_mb", float(base["min_size_mb"]))),
        extensions=extensions,
        movie_template=movie_template,
        tv_template=tv_template,
        action=action,
        delete_source=_bool(raw.get("delete_source"), _bool(base["delete_source"])),
        cleanup_empty_dirs=_bool(
            raw.get("cleanup_empty_dirs"), _bool(base["cleanup_empty_dirs"])
        ),
        auto_apply=_bool(raw.get("auto_apply"), _bool(base["auto_apply"])),
        auto_apply_confidence=min(
            1.0,
            max(0.0, _float(raw, "auto_apply_confidence", float(base["auto_apply_confidence"]))),
        ),
        poll_interval=max(1, _int(raw, "poll_interval", int(base["poll_interval"]))),
        stable_seconds=max(0, _int(raw, "stable_seconds", int(base["stable_seconds"]))),
        dry_run=_bool(raw.get("dry_run"), _bool(base["dry_run"])),
    )


def load(db) -> Settings:
    db.ensure_settings(defaults())
    return _settings_from_raw(db.settings())


def save(db, form: dict[str, str]) -> Settings:
    movie_template = form.get("movie_template", "").strip()
    tv_template = form.get("tv_template", "").strip()
    validate_template(movie_template, "Movie layout")
    validate_template(tv_template, "Show layout")

    extensions = _extensions(form.get("extensions", ""))
    action = form.get("action", "move").lower()
    if action not in ACTIONS:
        raise ValueError("Unknown action.")

    try:
        min_size = max(0.0, float(form.get("min_size_mb", "0")))
        confidence = min(1.0, max(0.0, float(form.get("auto_apply_confidence", "0.85"))))
        poll_interval = max(1, int(form.get("poll_interval", "60")))
        stable_seconds = max(0, int(form.get("stable_seconds", "120")))
    except (TypeError, ValueError) as exc:
        raise ValueError("Numeric settings are invalid.") from exc

    values = {
        "min_size_mb": str(min_size),
        "extensions": ",".join(extensions),
        "movie_template": movie_template,
        "tv_template": tv_template,
        "action": action,
        "delete_source": str(_bool(form.get("delete_source"))).lower(),
        "cleanup_empty_dirs": str(_bool(form.get("cleanup_empty_dirs"))).lower(),
        "auto_apply": str(_bool(form.get("auto_apply"))).lower(),
        "auto_apply_confidence": str(confidence),
        "poll_interval": str(poll_interval),
        "stable_seconds": str(stable_seconds),
        "dry_run": str(_bool(form.get("dry_run"))).lower(),
    }
    db.set_settings(values)
    return load(db)


def sample_values() -> dict[str, object]:
    return {
        "title": "Spirited Away",
        "year": 2001,
        "folder": "Spirited Away (2001)",
        "season": 2,
        "episode": 5,
        "episode_tag": "S02E05",
        "quality": "1080p",
        "source": "BluRay",
        "codec": "x264",
        "group": "GROUP",
        "ext": "mkv",
    }


def preview(template: str) -> str:
    try:
        return template.format(**sample_values())
    except (KeyError, ValueError) as exc:
        return f"Invalid layout: {exc}"
