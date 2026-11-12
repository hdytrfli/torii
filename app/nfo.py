from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


def _text(root: ET.Element, name: str) -> str | None:
    element = root.find(name)
    if element is None or element.text is None:
        return None
    value = element.text.strip()
    return value or None


def _int(value: str | None) -> int | None:
    try:
        return int(value) if value else None
    except (TypeError, ValueError):
        return None


def _year(root: ET.Element) -> int | None:
    year = _int(_text(root, "year"))
    if year:
        return year
    premiered = _text(root, "premiered") or _text(root, "releasedate")
    if premiered and len(premiered) >= 4:
        return _int(premiered[:4])
    return None


def _provider_ids(root: ET.Element) -> dict[str, str]:
    ids: dict[str, str] = {}
    for element in root.findall("uniqueid"):
        kind = (element.get("type") or "").strip().lower()
        value = (element.text or "").strip()
        if kind and value:
            ids[kind] = value

    for field, kind in (("tmdbid", "tmdb"), ("imdbid", "imdb"), ("tvdbid", "tvdb")):
        value = _text(root, field)
        if value and kind not in ids:
            ids[kind] = value
    return ids


def find(path: Path) -> Path | None:
    candidates = [path.with_suffix(".nfo")]
    candidates.append(path.parent / "movie.nfo")
    candidates.append(path.parent / "tvshow.nfo")

    seen: set[Path] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        if candidate.is_file():
            return candidate
    return None


def read(path: Path) -> dict[str, Any] | None:
    nfo_path = find(path)
    if nfo_path is None:
        return None

    try:
        root = ET.parse(nfo_path).getroot()
    except (ET.ParseError, OSError):
        return None

    tag = root.tag.lower()
    title = _text(root, "title") or _text(root, "originaltitle")
    episode_title = None
    if tag == "episodedetails":
        episode_title = title
        title = _text(root, "showtitle")

    season = _int(_text(root, "season"))
    episode = _int(_text(root, "episode"))
    kind = "tv" if tag in {"tvshow", "episodedetails"} or season is not None else "movie"

    return {
        "path": str(nfo_path),
        "tag": tag,
        "kind": kind,
        "title": title,
        "episode_title": episode_title,
        "year": _year(root),
        "season": season,
        "episode": episode,
        "provider_ids": _provider_ids(root),
    }
