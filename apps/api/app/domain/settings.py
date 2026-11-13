from __future__ import annotations

from dataclasses import dataclass
from string import Formatter

from ..core import deployment

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


def defaults() -> dict[str, str]:
    data = deployment.load()
    scan = data["scan"]
    layout = data["layout"]
    apply = data["apply"]
    queues = data["queues"]
    return {
        "min_size_mb": str(scan["min_size_mb"]),
        "extensions": ",".join(scan["extensions"]),
        "movie_template": layout["movie"],
        "tv_template": layout["shows"],
        "action": apply["action"],
        "cleanup_empty_dirs": str(apply["cleanup_empty_dirs"]).lower(),
        "auto_apply": str(apply["automation"]["auto_apply"]).lower(),
        "auto_apply_confidence": str(apply["automation"]["auto_apply_confidence"]),
        "poll_interval": str(scan["poll_interval"]),
        "stable_seconds": str(scan["stable_seconds"]),
        "queue_metadata_poll": str(queues["metadata_poll_seconds"]),
        "queue_promotion_poll": str(queues["promotion_poll_seconds"]),
        "queue_execution_poll": str(queues["execution_poll_seconds"]),
        "queue_revert_poll": str(queues["revert_poll_seconds"]),
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
    cleanup_empty_dirs: bool
    auto_apply: bool
    auto_apply_confidence: float
    poll_interval: int
    stable_seconds: int
    queue_metadata_poll: int
    queue_promotion_poll: int
    queue_execution_poll: int
    queue_revert_poll: int

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
        queue_metadata_poll=max(
            1, _int(raw, "queue_metadata_poll", int(base["queue_metadata_poll"]))
        ),
        queue_promotion_poll=max(
            1, _int(raw, "queue_promotion_poll", int(base["queue_promotion_poll"]))
        ),
        queue_execution_poll=max(
            1, _int(raw, "queue_execution_poll", int(base["queue_execution_poll"]))
        ),
        queue_revert_poll=max(
            1, _int(raw, "queue_revert_poll", int(base["queue_revert_poll"]))
        ),
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
        "cleanup_empty_dirs": str(_bool(form.get("cleanup_empty_dirs"))).lower(),
        "auto_apply": str(_bool(form.get("auto_apply"))).lower(),
        "auto_apply_confidence": str(confidence),
        "poll_interval": str(poll_interval),
        "stable_seconds": str(stable_seconds),
        "queue_metadata_poll": str(
            max(1, _int(form, "queue_metadata_poll", 1))
        ),
        "queue_promotion_poll": str(
            max(1, _int(form, "queue_promotion_poll", 1))
        ),
        "queue_execution_poll": str(
            max(1, _int(form, "queue_execution_poll", 1))
        ),
        "queue_revert_poll": str(
            max(1, _int(form, "queue_revert_poll", 1))
        ),
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
