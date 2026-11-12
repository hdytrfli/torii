from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from string import Formatter
from typing import Any
from urllib.parse import urlparse

import yaml

ALLOWED_PLACEHOLDERS = {
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
ACTIONS = {"move", "copy", "hardlink"}
LOG_LEVELS = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
DEFAULT_PATH = Path(__file__).resolve().parent.parent / "config.yaml"


class ConfigError(ValueError):
    pass


def _mapping(value: Any, path: str, allowed: set[str]) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ConfigError(f"{path} must be a mapping")
    unknown = sorted(set(value) - allowed)
    if unknown:
        raise ConfigError(f"{path} has unknown key(s): {', '.join(unknown)}")
    missing = sorted(allowed - set(value))
    if missing:
        raise ConfigError(f"{path} is missing key(s): {', '.join(missing)}")
    return value


def _text(value: Any, path: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ConfigError(f"{path} must be a non-empty string")
    return value.strip()


def _number(value: Any, path: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ConfigError(f"{path} must be a number")
    return float(value)


def _integer(value: Any, path: str, minimum: int | None = None, maximum: int | None = None) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ConfigError(f"{path} must be an integer")
    if minimum is not None and value < minimum:
        raise ConfigError(f"{path} must be at least {minimum}")
    if maximum is not None and value > maximum:
        raise ConfigError(f"{path} must be at most {maximum}")
    return int(value)


def _boolean(value: Any, path: str) -> bool:
    if not isinstance(value, bool):
        raise ConfigError(f"{path} must be true or false")
    return value


def _template(value: Any, path: str) -> str:
    text = _text(value, path)
    if text.startswith(("/", "\\")) or ".." in text:
        raise ConfigError(f"{path} must be a relative path without '..'")
    try:
        fields = list(Formatter().parse(text))
    except ValueError as exc:
        raise ConfigError(f"{path} is not a valid template: {exc}") from exc
    for _, field, _, _ in fields:
        if field is None:
            continue
        if field not in ALLOWED_PLACEHOLDERS:
            raise ConfigError(
                f"{path} uses unknown placeholder {{{field}}}; "
                f"allowed: {', '.join(sorted(ALLOWED_PLACEHOLDERS))}"
            )
    return text


def _url(value: Any, path: str) -> str:
    text = _text(value, path)
    parsed = urlparse(text)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ConfigError(f"{path} must be an http(s) URL")
    return text.rstrip("/")


def _extensions(value: Any, path: str) -> list[str]:
    if not isinstance(value, list) or not value:
        raise ConfigError(f"{path} must be a non-empty list")
    result = []
    for index, item in enumerate(value):
        text = _text(item, f"{path}[{index}]").lower().lstrip(".")
        if not text or any(char in text for char in "/\\ "):
            raise ConfigError(f"{path}[{index}] is not a valid extension")
        result.append(text)
    return list(dict.fromkeys(result))


@lru_cache(maxsize=8)
def _load_cached(path: str) -> dict[str, Any]:
    config_path = Path(path)
    if not config_path.is_file():
        raise ConfigError(f"Config file not found: {config_path}")
    try:
        raw = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        raise ConfigError(f"Could not read {config_path}: {exc}") from exc

    data = _mapping(
        raw,
        "config",
        {"paths", "server", "session_days", "scan", "layout", "apply"},
    )

    paths = _mapping(data["paths"], "paths", {"watch", "library", "state"})
    watch = _mapping(paths["watch"], "paths.watch", {"movies", "shows"})
    library = _mapping(paths["library"], "paths.library", {"movies", "shows"})
    paths = {
        "watch": {
            "movies": _text(watch["movies"], "paths.watch.movies"),
            "shows": _text(watch["shows"], "paths.watch.shows"),
        },
        "library": {
            "movies": _text(library["movies"], "paths.library.movies"),
            "shows": _text(library["shows"], "paths.library.shows"),
        },
        "state": _text(paths["state"], "paths.state"),
    }

    server = _mapping(data["server"], "server", {"host", "port", "log_level"})
    server = {
        "host": _text(server["host"], "server.host"),
        "port": _integer(server["port"], "server.port", 1, 65535),
        "log_level": _text(server["log_level"], "server.log_level").upper(),
    }
    if server["log_level"] not in LOG_LEVELS:
        raise ConfigError(f"server.log_level must be one of {', '.join(sorted(LOG_LEVELS))}")

    scan = _mapping(
        data["scan"],
        "scan",
        {"min_size_mb", "extensions", "poll_interval", "stable_seconds"},
    )
    min_size = _number(scan["min_size_mb"], "scan.min_size_mb")
    if min_size < 0:
        raise ConfigError("scan.min_size_mb must be at least 0")
    scan = {
        "min_size_mb": min_size,
        "extensions": _extensions(scan["extensions"], "scan.extensions"),
        "poll_interval": _integer(scan["poll_interval"], "scan.poll_interval", 1),
        "stable_seconds": _integer(scan["stable_seconds"], "scan.stable_seconds", 0),
    }

    layout = _mapping(data["layout"], "layout", {"movie", "shows"})
    layout = {
        "movie": _template(layout["movie"], "layout.movie"),
        "shows": _template(layout["shows"], "layout.shows"),
    }

    apply = _mapping(
        data["apply"],
        "apply",
        {"action", "copy", "cleanup_empty_dirs", "automation", "dry_run"},
    )
    action = _text(apply["action"], "apply.action").lower()
    if action not in ACTIONS:
        raise ConfigError(f"apply.action must be one of {', '.join(sorted(ACTIONS))}")

    copy_options = _mapping(apply["copy"], "apply.copy", {"delete_source"})
    automation = _mapping(
        apply["automation"],
        "apply.automation",
        {"auto_apply", "auto_apply_confidence"},
    )
    confidence = _number(
        automation["auto_apply_confidence"], "apply.automation.auto_apply_confidence"
    )
    if not 0 <= confidence <= 1:
        raise ConfigError("apply.automation.auto_apply_confidence must be between 0 and 1")

    apply = {
        "action": action,
        "copy": {
            "delete_source": _boolean(copy_options["delete_source"], "apply.copy.delete_source"),
        },
        "cleanup_empty_dirs": _boolean(
            apply["cleanup_empty_dirs"], "apply.cleanup_empty_dirs"
        ),
        "automation": {
            "auto_apply": _boolean(automation["auto_apply"], "apply.automation.auto_apply"),
            "auto_apply_confidence": confidence,
        },
        "dry_run": _boolean(apply["dry_run"], "apply.dry_run"),
    }

    return {
        "paths": paths,
        "server": server,
        "session_days": _integer(data["session_days"], "session_days", 1),
        "scan": scan,
        "layout": layout,
        "apply": apply,
    }


def load(path: str | Path | None = None) -> dict[str, Any]:
    selected = Path(path or os.getenv("CONFIG_FILE") or DEFAULT_PATH)
    return _load_cached(str(selected.resolve()))
