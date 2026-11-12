from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .guess import Parsed

INVALID = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
RESERVED = {
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
}


def sanitize(value: Any, fallback: str = "Unknown") -> str:
    text = INVALID.sub("", str(value))
    text = re.sub(r"\s+", " ", text).strip(" .")
    if not text:
        text = fallback
    if text.upper() in RESERVED:
        text = f"_{text}"
    return text[:120].rstrip(" .")


def build_values(
    title: str,
    year: int | None,
    season: int | None,
    episode: int | None,
    ext: str,
    parsed: Parsed | None = None,
) -> dict[str, Any]:
    title = sanitize(title)
    year_value = int(year) if year else None
    folder = f"{title} ({year_value})" if year_value else title

    season_value = int(season) if season is not None else 1
    episode_value = int(episode) if episode is not None else 1
    episode_tag = f"S{season_value:02d}E{episode_value:02d}"
    if parsed and parsed.episode_end and parsed.episode_end > episode_value:
        episode_tag += f"-E{parsed.episode_end:02d}"

    return {
        "title": title,
        "year": year_value or "",
        "folder": folder,
        "season": season_value,
        "episode": episode_value,
        "episode_tag": episode_tag,
        "quality": sanitize(parsed.quality, "") if parsed and parsed.quality else "",
        "source": sanitize(parsed.source, "") if parsed and parsed.source else "",
        "codec": sanitize(parsed.codec, "") if parsed and parsed.codec else "",
        "group": sanitize(parsed.group, "") if parsed and parsed.group else "",
        "ext": ext.lower().lstrip("."),
    }


def render(base: Path, template: str, values: dict[str, Any]) -> Path:
    raw = template.format(**values)
    parts = [part for part in Path(raw).parts if part not in ("", ".")]
    if not parts or any(part == ".." for part in parts):
        raise ValueError("Layout produced an invalid path.")

    safe_parts = [sanitize(part) for part in parts]
    target = base.joinpath(*safe_parts)
    target = target.with_name(f"{target.name}.{values['ext']}")

    base_resolved = base.resolve()
    target_resolved = target.resolve(strict=False)
    if not target_resolved.is_relative_to(base_resolved):
        raise ValueError("Layout escaped the library root.")
    return target


def target_for_movie(library: Path, template: str, title: str, year: int | None,
                     ext: str, parsed: Parsed | None = None) -> Path:
    base = library / "movies"
    values = build_values(title, year, None, None, ext, parsed)
    return render(base, template, values)


def target_for_show(library: Path, template: str, title: str, year: int | None,
                    season: int | None, episode: int | None, ext: str,
                    parsed: Parsed | None = None) -> Path:
    if season is None or episode is None:
        raise ValueError("Season and episode are required for shows.")

    base = library / "shows"
    values = build_values(title, year, season, episode, ext, parsed)
    return render(base, template, values)


def preview_movie(library: Path, template: str, title: str, year: int | None,
                  ext: str = "mkv", parsed: Parsed | None = None) -> str:
    try:
        return str(target_for_movie(library, template, title, year, ext, parsed))
    except ValueError as exc:
        return f"Invalid layout: {exc}"


def preview_show(library: Path, template: str, title: str, year: int | None,
                 season: int | None, episode: int | None, ext: str = "mkv",
                 parsed: Parsed | None = None) -> str:
    try:
        return str(target_for_show(library, template, title, year, season, episode, ext, parsed))
    except ValueError as exc:
        return f"Invalid layout: {exc}"
