from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from guessit import guessit


def _first(value: Any) -> Any:
    if isinstance(value, list):
        return value[0] if value else None
    return value


def _int(value: Any) -> int | None:
    value = _first(value)
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


@dataclass
class Parsed:
    title: str | None
    year: int | None
    season: int | None
    episode: int | None
    episode_end: int | None
    kind: str
    quality: str | None
    source: str | None
    codec: str | None
    group: str | None
    confidence: float
    raw: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "year": self.year,
            "season": self.season,
            "episode": self.episode,
            "episode_end": self.episode_end,
            "kind": self.kind,
            "quality": self.quality,
            "source": self.source,
            "codec": self.codec,
            "group": self.group,
            "confidence": self.confidence,
            "raw": self.raw,
        }


def parse(path: Path) -> Parsed:
    data = guessit(path.stem)
    title = _first(data.get("title"))
    if not title:
        parent = path.parent.name
        if parent and not parent.lower().startswith("season "):
            title = parent

    season = _int(data.get("season"))
    episode = _int(data.get("episode"))
    episode_end = None
    raw_episode = data.get("episode")
    if isinstance(raw_episode, list) and len(raw_episode) > 1:
        episode_end = _int(raw_episode[1])

    kind = "tv" if season is not None or episode is not None else "movie"
    title = str(title).strip() if title else None

    score = 0.2
    if title:
        score += 0.3
        if len(title) > 2:
            score += 0.1
    if _int(data.get("year")):
        score += 0.2
    if season is not None or episode is not None:
        score += 0.2
    confidence = min(0.95, score)

    return Parsed(
        title=title,
        year=_int(data.get("year")),
        season=season,
        episode=episode,
        episode_end=episode_end,
        kind=kind,
        quality=str(data.get("screen_size")) if data.get("screen_size") else None,
        source=str(data.get("source")) if data.get("source") else None,
        codec=str(data.get("video_codec")) if data.get("video_codec") else None,
        group=str(data.get("release_group")) if data.get("release_group") else None,
        confidence=confidence,
        raw={key: value for key, value in data.items() if _is_jsonable(value)},
    )


def _is_jsonable(value: Any) -> bool:
    if isinstance(value, (str, int, float, bool)) or value is None:
        return True
    if isinstance(value, (list, tuple)):
        return all(_is_jsonable(item) for item in value)
    if isinstance(value, dict):
        return all(_is_jsonable(item) for item in value.values())
    return False
