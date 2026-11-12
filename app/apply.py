from __future__ import annotations

import json
import logging
import os
import shlex
import shutil
import subprocess
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import httpx

from . import naming
from .settings import Settings

logger = logging.getLogger(__name__)

SIDECAR_SUFFIXES = {".srt", ".ass", ".ssa", ".vtt", ".sub", ".idx", ".nfo"}


def _parsed(job: dict[str, Any]) -> SimpleNamespace | None:
    value = job.get("parsed_json")
    if not value:
        return None
    try:
        return SimpleNamespace(**json.loads(value))
    except (TypeError, json.JSONDecodeError):
        return None


def _apply_file(src: Path, target: Path, action: str, delete_source: bool) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)

    if action == "move":
        shutil.move(str(src), str(target))
    elif action == "copy":
        shutil.copy2(src, target)
        if delete_source:
            src.unlink(missing_ok=True)
    elif action == "hardlink":
        os.link(src, target)
    else:
        raise ValueError(f"Unknown action: {action}")


def _target_for_job(cfg, settings: Settings, job: dict[str, Any],
                    title: str, year: int | None, media_type: str,
                    season: int | None, episode: int | None) -> Path:
    source = Path(job["source_path"])
    parsed = _parsed(job)
    if media_type == "tv":
        return naming.target_for_show(
            cfg.show_library_dir,
            settings.tv_template,
            title,
            year,
            season,
            episode,
            source.suffix,
            parsed,
        )
    return naming.target_for_movie(
        cfg.movie_library_dir,
        settings.movie_template,
        title,
        year,
        source.suffix,
        parsed,
    )


def preview_target(cfg, settings: Settings, job: dict[str, Any],
                   title: str, year: int | None, media_type: str,
                   season: int | None, episode: int | None) -> str:
    try:
        return str(_target_for_job(cfg, settings, job, title, year, media_type, season, episode))
    except ValueError as exc:
        return f"Invalid layout: {exc}"


def _sidecars(src: Path) -> list[Path]:
    result = []
    for path in src.parent.glob(f"{src.stem}.*"):
        if path.is_file() and path.suffix.lower() in SIDECAR_SUFFIXES:
            result.append(path)
    return result


def _watch_root(cfg, source: Path) -> Path:
    resolved = source.resolve()
    for root in cfg.watch_dirs:
        try:
            if resolved.is_relative_to(root.resolve()):
                return root
        except OSError:
            continue
    return source.parent


def _cleanup_empty(start: Path, stop: Path) -> None:
    current = start
    stop = stop.resolve()
    while current.resolve() != stop and current.resolve().is_relative_to(stop):
        try:
            current.rmdir()
        except OSError:
            break
        current = current.parent


def _notify(url: str | None, title: str, message: str) -> None:
    if not url:
        return
    try:
        httpx.post(
            url,
            content=message.encode("utf-8"),
            headers={"Title": title, "Tags": "film"},
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        logger.warning("Notification failed: %s", exc)


def _post_action(command: str | None, env: dict[str, str]) -> None:
    if not command:
        return
    try:
        subprocess.run(shlex.split(command), env={**os.environ, **env},
                       check=False, timeout=120)
    except (OSError, subprocess.SubprocessError) as exc:
        logger.warning("Post action failed: %s", exc)


def apply_job(cfg, settings: Settings, db, job: dict[str, Any],
              title: str, year: int | None, media_type: str,
              season: int | None, episode: int | None,
              action: str | None = None) -> tuple[bool, str, Path | None]:
    source = Path(job["source_path"])
    if not source.exists():
        return False, "Source file no longer exists.", None

    try:
        target = _target_for_job(cfg, settings, job, title, year, media_type, season, episode)
    except ValueError as exc:
        return False, str(exc), None

    if target.exists():
        db.update_job(job["id"], status="needs_review", error=f"Target exists: {target}")
        return False, f"Target already exists: {target}", None

    chosen_action = (action or settings.action).lower()
    if chosen_action not in {"move", "copy", "hardlink"}:
        return False, f"Unknown action: {chosen_action}", None

    if settings.dry_run:
        return True, f"Dry run: would {chosen_action} to {target}", target

    sidecars = _sidecars(source)
    try:
        _apply_file(source, target, chosen_action, settings.delete_source)
        for sidecar in sidecars:
            sidecar_target = target.with_name(f"{target.stem}{sidecar.suffix}")
            if not sidecar_target.exists():
                _apply_file(sidecar, sidecar_target, chosen_action, settings.delete_source)
    except OSError as exc:
        db.update_job(job["id"], status="needs_review", error=str(exc))
        return False, f"File operation failed: {exc}", None

    db.update_job(
        job["id"],
        status="moved",
        target_path=str(target),
        title=title,
        year=year,
        media_type=media_type,
        season=season,
        episode=episode,
        error=None,
        reason="Approved.",
    )

    if settings.cleanup_empty_dirs:
        _cleanup_empty(source.parent, _watch_root(cfg, source))

    _notify(cfg.notify_url, "Media renamed", f"{source.name} -> {target}")
    _post_action(cfg.post_action_cmd, {
        "SOURCE": str(source),
        "TARGET": str(target),
        "TITLE": title,
        "YEAR": str(year or ""),
        "SEASON": str(season or ""),
        "EPISODE": str(episode or ""),
    })

    logger.info("Moved %s to %s", source, target)
    return True, f"Moved to {target}", target
