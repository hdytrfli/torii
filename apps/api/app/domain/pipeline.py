from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from . import guess, naming, nfo, settings as settings_mod
from ..services import providers

logger = logging.getLogger(__name__)


MIN_PROVIDER_SCORE = 75.0


def _candidate_best(candidates: list[providers.Candidate]) -> providers.Candidate | None:
    if candidates and candidates[0].score >= MIN_PROVIDER_SCORE:
        return candidates[0]
    return None


def _filename_has_enough_detail(parsed: guess.Parsed) -> bool:
    if not parsed.title:
        return False
    if parsed.kind == "tv":
        return (
            parsed.season is not None
            and parsed.episode is not None
            and parsed.confidence >= 0.8
        )
    return parsed.year is not None and parsed.confidence >= 0.7


def _int(value: Any) -> int | None:
    try:
        return int(value) if value is not None and str(value).strip() else None
    except (TypeError, ValueError):
        return None


def _confidence(parsed: guess.Parsed, best: providers.Candidate | None,
                candidates: list[providers.Candidate]) -> float:
    confidence = parsed.confidence * 0.8
    if best is not None:
        confidence = max(confidence, best.score / 100.0)
        if parsed.year and best.year and parsed.year == best.year:
            confidence = min(1.0, confidence + 0.05)
        if len(candidates) > 1 and candidates[0].score - candidates[1].score < 8:
            confidence = min(1.0, confidence + 0.02)
    if parsed.kind == "tv" and (parsed.season is None or parsed.episode is None):
        confidence -= 0.25
    return max(0.0, min(1.0, confidence))


def analyze(cfg, settings: settings_mod.Settings, db, path: Path,
            jellyfin: providers.JellyfinProvider, llm: providers.LLM,
            forced_kind: str | None = None) -> dict[str, Any]:
    parsed = guess.parse(path)
    local = nfo.read(path)
    nfo_candidate = None
    source = "guessit"
    ai_attempted = False

    if local:
        if local.get("title"):
            parsed.title = local["title"]
        if local.get("year"):
            parsed.year = local["year"]
        if local.get("season") is not None:
            parsed.season = local["season"]
        if local.get("episode") is not None:
            parsed.episode = local["episode"]
        if local.get("kind"):
            parsed.kind = local["kind"]
        parsed.confidence = max(parsed.confidence, 0.9)

        if local.get("title"):
            ids = local.get("provider_ids") or {}
            provider_id = next(iter(ids.values()), None)
            nfo_candidate = providers.Candidate(
                provider="nfo",
                provider_id=provider_id,
                title=local["title"],
                year=local.get("year"),
                overview=f"Local metadata from {local['path']}",
                image=None,
                kind=forced_kind or local.get("kind") or parsed.kind,
                score=100.0,
                raw={"path": local["path"], "provider_ids": ids},
            )
            source = "nfo"

    if forced_kind in {"movie", "tv"}:
        parsed.kind = forced_kind
        if forced_kind == "movie":
            parsed.season = None
            parsed.episode = None
            parsed.episode_end = None

    providers_checked = False
    if _filename_has_enough_detail(parsed):
        candidates = []
    else:
        providers_checked = True
        candidates = jellyfin.search(parsed.title, parsed.year, parsed.kind)
    if nfo_candidate is not None:
        candidates = [nfo_candidate] + [
            candidate
            for candidate in candidates
            if not (
                candidate.title.casefold() == nfo_candidate.title.casefold()
                and candidate.year == nfo_candidate.year
            )
        ]

    best = _candidate_best(candidates)
    if best is not None and best.provider != "nfo":
        source = "jellyfin"
    confidence = _confidence(parsed, best, candidates)
    decision: dict[str, Any] | None = None

    # AI is the last resort: only ask it after provider lookup returned nothing.
    if parsed.title and not candidates and llm.enabled and providers_checked:
        ai_attempted = True
        decision = llm.normalize(path.stem, parsed, candidates)
        if decision and decision.get("title"):
            decision_title = str(decision["title"])
            decision_year = decision.get("year")
            decision_kind = str(decision.get("media_type") or parsed.kind)
            if decision_kind not in {"movie", "tv"}:
                decision_kind = parsed.kind
            refreshed = jellyfin.search(
                decision_title,
                _int(decision_year),
                decision_kind,
            )
            if refreshed:
                candidates = refreshed
                best = _candidate_best(candidates)
                if best is not None:
                    confidence = max(confidence, best.score / 100.0)
                    source = "jellyfin" if best.provider != "nfo" else "nfo"
                else:
                    source = "llm"
            else:
                source = "llm"

    title = (best.title if best else None) or (decision.get("title") if decision else None) \
        or parsed.title or path.stem
    year = (best.year if best else None) or (decision.get("year") if decision else None) \
        or parsed.year
    media_type = (best.kind if best else None) or (decision.get("media_type") if decision else None) \
        or parsed.kind
    if media_type not in {"movie", "tv"}:
        media_type = parsed.kind
    if forced_kind in {"movie", "tv"}:
        media_type = forced_kind

    season = parsed.season
    episode = parsed.episode
    if decision:
        season = _int(decision.get("season")) or season
        episode = _int(decision.get("episode")) or episode
    if forced_kind == "movie":
        season = None
        episode = None

    if media_type == "tv":
        group_type = "show"
        group_key = f"show:{str(title).casefold()}|{year or ''}"
    else:
        try:
            relative_parent = path.parent.resolve().relative_to(
                cfg.movie_watch_dir.resolve()
            )
        except (OSError, ValueError):
            relative_parent = Path(path.parent.name)
        relative_text = relative_parent.as_posix()
        if relative_text in {"", "."}:
            group_type = "movie"
            group_key = f"movie:{str(title).casefold()}|{year or ''}"
        else:
            group_type = "collection"
            group_key = f"collection:{relative_text}"

    target = None
    target_error = None
    try:
        if media_type == "tv":
            target = naming.target_for_show(
                cfg.show_library_dir,
                settings.tv_template,
                title,
                int(year) if year else None,
                season,
                episode,
                path.suffix,
                parsed,
            )
        else:
            target = naming.target_for_movie(
                cfg.movie_library_dir,
                settings.movie_template,
                title,
                int(year) if year else None,
                path.suffix,
                parsed,
            )
    except ValueError as exc:
        target_error = str(exc)

    if target_error:
        confidence = min(confidence, 0.4)

    status = "needs_review"

    parsed_payload = parsed.to_dict()
    parsed_payload["nfo"] = local

    payload = {
        "source": source,
        "group_key": group_key,
        "group_type": group_type,
        "media_type": media_type,
        "title": str(title),
        "year": int(year) if year else None,
        "season": season,
        "episode": episode,
        "confidence": round(confidence, 3),
        "reason": (decision.get("reason") if decision and decision.get("title") else None)
        or {
            "nfo": "Local NFO metadata selected.",
            "jellyfin": "Jellyfin candidate selected.",
            "llm": "AI fallback selected.",
            "guessit": (
                "Parsed from filename; provider lookup skipped."
                if not providers_checked
                else "Parsed from filename."
            )
            + (" AI fallback returned no usable match." if ai_attempted and not decision else ""),
        }.get(source, "Parsed from filename."),
        "parsed_json": json.dumps(parsed_payload, ensure_ascii=False),
        "candidates_json": json.dumps([candidate.to_dict() for candidate in candidates], ensure_ascii=False),
        "llm_json": json.dumps(decision, ensure_ascii=False) if decision else None,
        "target_path": str(target) if target else None,
        "error": target_error,
        "blocked_reason": "invalid_layout" if target_error else None,
        "status": status,
    }

    existing = db.get_job_by_source(str(path))
    stat = path.stat()
    if existing:
        db.update_job(existing["id"], source_size=stat.st_size, source_mtime=stat.st_mtime, **payload)
        return db.get_job(existing["id"]) or existing

    job_id = db.create_job(
        path,
        stat.st_size,
        stat.st_mtime,
        **payload,
    )
    logger.info(
        "Job created",
        extra={"job_id": job_id, "detail": {"source_path": str(path)}},
    )
    return db.get_job(job_id) or {}
