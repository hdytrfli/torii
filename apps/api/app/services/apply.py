from __future__ import annotations

import errno
import json
import logging
import os
import shlex
import shutil
import subprocess
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Callable

import httpx

from ..domain import lifecycle, naming
from ..domain.settings import Settings

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


def _copy_with_progress(
    src: Path,
    target: Path,
    progress: Callable[[int, int], None] | None,
) -> None:
    total = src.stat().st_size
    done = 0
    with src.open("rb") as source, target.open("wb") as destination:
        while True:
            chunk = source.read(1024 * 1024)
            if not chunk:
                break
            destination.write(chunk)
            done += len(chunk)
            if progress:
                progress(done, total)
    shutil.copystat(src, target)
    if progress and total == 0:
        progress(0, 0)


def _apply_file(
    src: Path,
    target: Path,
    action: str,
    progress: Callable[[int, int], None] | None = None,
) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    total = src.stat().st_size

    if action == "move":
        try:
            os.replace(src, target)
            if progress:
                progress(total, total)
        except OSError as exc:
            if exc.errno != errno.EXDEV:
                raise
            try:
                _copy_with_progress(src, target, progress)
                src.unlink()
            except OSError:
                target.unlink(missing_ok=True)
                raise
    elif action == "copy":
        try:
            _copy_with_progress(src, target, progress)
        except OSError:
            target.unlink(missing_ok=True)
            raise
    elif action == "hardlink":
        os.link(src, target)
        if progress:
            progress(total, total)
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
              action: str | None = None,
              operation_id: int | None = None,
              progress: Callable[[int, int], None] | None = None
              ) -> tuple[bool, str, Path | None]:
    source = Path(job["source_path"])
    if not source.exists():
        lifecycle.release(db, int(job["id"]))
        lifecycle.block(
            db,
            int(job["id"]),
            "source_missing",
            "Source file no longer exists.",
            status="failed",
        )
        return False, "Source file no longer exists.", None

    try:
        target = _target_for_job(cfg, settings, job, title, year, media_type, season, episode)
    except ValueError as exc:
        lifecycle.block(db, int(job["id"]), "invalid_layout", str(exc))
        return False, str(exc), None

    owner = db.get_target_reservation(str(target))
    if owner is not None and int(owner["job_id"]) != int(job["id"]):
        message = f"Duplicate target with {owner['source_path']}"
        lifecycle.block(db, int(job["id"]), "duplicate_target", message)
        return False, message, None

    duplicate = db.get_job_by_target(str(target), exclude_id=int(job["id"]))
    if duplicate:
        duplicate_is_marked = str(duplicate.get("error") or "").startswith(
            "Duplicate target with "
        )
        if not duplicate_is_marked:
            message = f"Duplicate target with {Path(duplicate['source_path']).name}"
            lifecycle.block(db, int(job["id"]), "duplicate_target", message)
            return False, message, None

    if owner is None and not db.reserve_target(int(job["id"]), str(target)):
        owner = db.get_target_reservation(str(target))
        message = (
            f"Duplicate target with {owner['source_path']}"
            if owner
            else "Duplicate target with another job"
        )
        lifecycle.block(db, int(job["id"]), "duplicate_target", message)
        return False, message, None

    if target.exists():
        lifecycle.block(
            db,
            int(job["id"]),
            "target_exists",
            f"Target already exists: {target}",
        )
        return False, f"Target already exists: {target}", None

    chosen_action = (action or settings.action).lower()
    if chosen_action not in {"move", "copy", "hardlink"}:
        lifecycle.block(
            db,
            int(job["id"]),
            "invalid_action",
            f"Unknown action: {chosen_action}",
        )
        return False, f"Unknown action: {chosen_action}", None

    if operation_id is None:
        operation_id = db.create_operation(
            int(job["id"]), chosen_action, str(source), str(target), status="running"
        )
    total_size = source.stat().st_size
    db.update_operation(
        operation_id,
        status="running",
        progress_total=total_size,
        message="Starting",
    )

    def report(done: int, total: int) -> None:
        if progress is not None:
            progress(done, total)
        else:
            db.update_operation(
                operation_id,
                progress_done=done,
                progress_total=total,
                message="Copying" if chosen_action == "copy" else "Applying",
            )

    sidecars = _sidecars(source)
    try:
        _apply_file(source, target, chosen_action, report)
        for sidecar in sidecars:
            sidecar_target = target.with_name(f"{target.stem}{sidecar.suffix}")
            if not sidecar_target.exists():
                _apply_file(sidecar, sidecar_target, chosen_action)
        db.update_operation(
            operation_id,
            status="committed",
            progress_done=total_size,
            progress_total=total_size,
            message="Completed",
        )
    except OSError as exc:
        db.update_operation(
            operation_id, status="failed", message=str(exc)
        )
        lifecycle.block(
            db,
            int(job["id"]),
            "operation_failed",
            f"File operation failed: {exc}",
        )
        return False, f"File operation failed: {exc}", None

    rename_source = job.get("source") or "guessit"
    if (
        job.get("title") != title
        or job.get("year") != year
        or job.get("media_type") != media_type
        or job.get("season") != season
        or job.get("episode") != episode
    ):
        rename_source = "manual"

    db.update_job(
        job["id"],
        status="moved",
        source=rename_source,
        target_path=str(target),
        title=title,
        year=year,
        media_type=media_type,
        season=season,
        episode=episode,
        error=None,
        blocked_reason=None,
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

    verb = {"move": "Moved", "copy": "Copied", "hardlink": "Linked"}[chosen_action]
    logger.info("%s %s to %s", verb, source, target)
    return True, f"{verb} to {target}", target


def undo_job(cfg, settings: Settings, db, job: dict[str, Any]) -> tuple[bool, str]:
    if job.get("status") != "moved":
        return False, "Only applied jobs can be undone."
    target = Path(job.get("target_path") or "")
    source = Path(job["source_path"])
    operation = db.latest_operation(int(job["id"]))

    if target.exists() and not target.is_file():
        lifecycle.block(
            db,
            int(job["id"]),
            "permission_denied",
            "Target is not a file; refusing to touch it.",
            status="moved",
        )
        return False, "Target is not a file; refusing to touch it."

    if not target.is_file():
        lifecycle.release(db, int(job["id"]))
        if source.is_file():
            stat = source.stat()
            db.update_job(
                job["id"],
                status="needs_review",
                target_path=None,
                source_size=stat.st_size,
                source_mtime=stat.st_mtime,
                error=None,
                blocked_reason=None,
                reason="Undo: target was already missing; source retained.",
                auto_apply_eligible=0,
            )
            return True, "Target was already missing; source retained."
        lifecycle.block(
            db,
            int(job["id"]),
            "source_missing",
            "Source and target files are missing.",
            status="failed",
        )
        db.update_job(job["id"], target_path=None)
        return False, "Source and target files are missing."

    if not any(
        _is_relative(target, root) for root in cfg.library_dirs
    ):
        lifecycle.block(
            db,
            int(job["id"]),
            "permission_denied",
            "Target is outside the library; refusing to touch it.",
            status="moved",
        )
        return False, "Target is outside the library; refusing to touch it."

    sidecars = _sidecars(target)
    try:
        if source.exists():
            target.unlink()
            for sidecar in sidecars:
                sidecar.unlink(missing_ok=True)
            message = "Target copy removed; source retained."
        else:
            source.parent.mkdir(parents=True, exist_ok=True)
            if source.exists():
                return False, "Source path already exists."
            shutil.move(str(target), str(source))
            for sidecar in sidecars:
                sidecar_source = source.with_name(f"{source.stem}{sidecar.suffix}")
                if not sidecar_source.exists():
                    shutil.move(str(sidecar), str(sidecar_source))
            message = "Target moved back to the source path."
    except OSError as exc:
        lifecycle.block(
            db,
            int(job["id"]),
            "operation_failed",
            f"Undo failed: {exc}",
            status="moved",
        )
        return False, f"Undo failed: {exc}"

    if settings.cleanup_empty_dirs:
        root = next((item for item in cfg.library_dirs if _is_relative(target, item)), None)
        if root is not None:
            _cleanup_empty(target.parent, root)

    if operation:
        db.update_operation(int(operation["id"]), "reversed")
    lifecycle.release(db, int(job["id"]))
    stat = source.stat()
    db.update_job(
        job["id"],
        status="needs_review",
        target_path=None,
        source_size=stat.st_size,
        source_mtime=stat.st_mtime,
        error=None,
        blocked_reason=None,
        reason=f"Undo: {message}",
        auto_apply_eligible=0,
    )
    return True, message


def delete_job(cfg, settings: Settings, db, job: dict[str, Any]) -> tuple[bool, str]:
    source = Path(job["source_path"])
    if job.get("status") == "moved":
        db.delete_job(job["id"])
        return True, "Job removed; library file kept."

    deleted = False
    if source.exists():
        if not source.is_file():
            return False, "Source is not a file; refusing to delete."
        if not any(_is_relative(source, root) for root in cfg.watch_dirs):
            return False, "Source is outside the watch folders; refusing to delete."
        sidecars = _sidecars(source)
        try:
            for sidecar in sidecars:
                sidecar.unlink(missing_ok=True)
            source.unlink()
            deleted = True
        except OSError as exc:
            return False, f"Delete failed: {exc}"
        if settings.cleanup_empty_dirs:
            _cleanup_empty(source.parent, _watch_root(cfg, source))

    db.delete_job(job["id"])
    return True, "Source file deleted and job removed." if deleted else "Job removed."


def _is_relative(path: Path, root: Path) -> bool:
    try:
        return path.resolve().is_relative_to(root.resolve())
    except OSError:
        return False
