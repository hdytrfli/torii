from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any

import httpx
from rapidfuzz import fuzz

from .guess import Parsed

logger = logging.getLogger(__name__)


@dataclass
class Candidate:
    provider: str
    provider_id: str | None
    title: str
    year: int | None
    overview: str
    image: str | None
    kind: str
    score: float = 0.0
    raw: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "provider_id": self.provider_id,
            "title": self.title,
            "year": self.year,
            "overview": self.overview,
            "image": self.image,
            "kind": self.kind,
            "score": round(self.score, 2),
        }


def _score(query: str, year: int | None, candidate: Candidate, index: int) -> float:
    query_lower = query.casefold()
    title_lower = candidate.title.casefold()
    score = max(
        fuzz.token_set_ratio(query_lower, title_lower),
        fuzz.partial_ratio(query_lower, title_lower) * 0.9,
    )

    if year and candidate.year:
        if year == candidate.year:
            score += 15
        elif abs(year - candidate.year) <= 1:
            score += 8
        else:
            score -= 20

    score += max(0.0, 5.0 - index * 1.5)
    return max(0.0, min(100.0, score))


class JellyfinProvider:
    def __init__(self, base_url: str | None, api_key: str | None):
        self.base_url = base_url.rstrip("/") if base_url else None
        self.api_key = api_key
        self.enabled = bool(self.base_url and self.api_key)

    def search(self, title: str | None, year: int | None, kind: str) -> list[Candidate]:
        if not self.enabled or not title:
            return []

        endpoint = "Series" if kind == "tv" else "Movie"
        search_info: dict[str, Any] = {"Name": title}
        if year:
            search_info["Year"] = int(year)

        payload = {
            "SearchInfo": search_info,
            "IncludeDisabledProviders": False,
        }

        try:
            with httpx.Client(timeout=20.0) as client:
                response = client.post(
                    f"{self.base_url}/Items/RemoteSearch/{endpoint}",
                    json=payload,
                    headers={"X-Emby-Token": self.api_key or ""},
                )
            if response.status_code >= 400:
                logger.warning("Jellyfin search failed: %s %s", response.status_code, response.text[:200])
                return []
            data = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("Jellyfin search error: %s", exc)
            return []

        if not isinstance(data, list):
            return []

        candidates: list[Candidate] = []
        for index, item in enumerate(data):
            ids = item.get("ProviderIds") or {}
            provider_id = ids.get("Tmdb") or ids.get("Imdb") or ids.get("Tvdb")
            candidate = Candidate(
                provider="jellyfin",
                provider_id=str(provider_id) if provider_id else None,
                title=item.get("Name") or title,
                year=item.get("ProductionYear"),
                overview=item.get("Overview") or "",
                image=item.get("ImageUrl"),
                kind=kind,
                raw=item,
            )
            candidate.score = _score(title, year, candidate, index)
            candidates.append(candidate)

        return sorted(candidates, key=lambda item: item.score, reverse=True)[:6]


class LLM:
    def __init__(self, base_url: str | None, api_key: str | None, model: str | None):
        self.base_url = base_url.rstrip("/") if base_url else None
        self.api_key = api_key
        self.model = model
        self.enabled = bool(self.base_url and self.api_key and self.model)

    def normalize(self, release: str, parsed: Parsed,
                  candidates: list[Candidate]) -> dict[str, Any] | None:
        if not self.enabled:
            return None

        payload = {
            "release": release,
            "parsed": parsed.to_dict(),
            "candidates": [candidate.to_dict() for candidate in candidates[:6]],
        }
        messages = [
            {
                "role": "system",
                "content": (
                    "You resolve media release names for a Jellyfin library. "
                    "Return only JSON with keys: title, year, media_type (movie or tv), "
                    "season, episode, confidence (0 to 1), reason. "
                    "Do not invent titles. If you are unsure, lower confidence."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(payload, ensure_ascii=False),
            },
        ]
        return self._chat(messages)

    def verify(self, release: str, parsed: Parsed,
               candidate: Candidate) -> dict[str, Any] | None:
        if not self.enabled:
            return None

        payload = {
            "release": release,
            "parsed": parsed.to_dict(),
            "candidate": candidate.to_dict(),
        }
        messages = [
            {
                "role": "system",
                "content": (
                    "You check whether a release name matches a metadata candidate. "
                    "Return only JSON with keys: match (true or false), confidence (0 to 1), "
                    "reason. Be strict about year and country variants."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(payload, ensure_ascii=False),
            },
        ]
        return self._chat(messages)

    def _chat(self, messages: list[dict[str, str]]) -> dict[str, Any] | None:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.model,
            "messages": messages,
            "temperature": 0,
            "max_tokens": 400,
            "response_format": {"type": "json_object"},
        }

        try:
            with httpx.Client(timeout=45.0) as client:
                response = client.post(url, json=body, headers=headers)
                if response.status_code == 400:
                    body.pop("response_format", None)
                    response = client.post(url, json=body, headers=headers)
                response.raise_for_status()
                content = response.json()["choices"][0]["message"]["content"]
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            logger.warning("LLM request failed: %s", exc)
            return None

        return _extract_json(content)


def _extract_json(content: str) -> dict[str, Any] | None:
    start = content.find("{")
    end = content.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        data = json.loads(content[start:end + 1])
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None
