from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from . import guess, naming, providers, settings as settings_mod

logger = logging.getLogger(__name__)


def _candidate_best(candidates: list[providers.Candidate]) -> providers.Candidate | None:
    return candidates[0] if candidates else None


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
            jellyfin: providers.JellyfinProvider, llm: providers.LLM) -> dict[str, Any]:
    parsed = guess.parse(path)
    candidates = jellyfin.search(parsed.title, parsed.year, parsed.kind)
    best = _candidate_best(candidates)
    confidence = _confidence(parsed, best, candidates)
    decision: dict[str, Any] | None = None

    if parsed.title and (best is None or confidence < settings.auto_apply_confidence):
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
                best = candidates[0]
                confidence = max(confidence, best.score / 100.0)

    if best is not None and llm.enabled and len(candidates) > 1:
        margin = candidates[0].score - candidates[1].score
        if margin < 10:
            verdict = llm.verify(path.stem, parsed, best)
            if verdict is not None and verdict.get("match") is False:
                confidence = max(0.0, confidence - 0.2)

    title = (best.title if best else None) or (decision.get("title") if decision else None) \
        or parsed.title or path.stem
    year = (best.year if best else None) or (decision.get("year") if decision else None) \
        or parsed.year
    media_type = (best.kind if best else None) or (decision.get("media_type") if decision else None) \
        or parsed.kind
    if media_type not in {"movie", "tv"}:
        media_type = parsed.kind

    season = parsed.season
    episode = parsed.episode
    if decision:
        season = _int(decision.get("season")) or season
        episode = _int(decision.get("episode")) or episode

    target = None
    target_error = None
    try:
        if media_type == "tv":
            target = naming.target_for_show(
                cfg.library_dir,
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
                cfg.library_dir,
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

    status = "ready" if settings.auto_apply and confidence >= settings.auto_apply_confidence else "needs_review"
    if target_error:
        status = "needs_review"

    payload = {
        "media_type": media_type,
        "title": str(title),
        "year": int(year) if year else None,
        "season": season,
        "episode": episode,
        "confidence": round(confidence, 3),
        "reason": (decision.get("reason") if decision else None) or (
            "Provider candidate selected." if best else "Parsed from filename."
        ),
        "parsed_json": json.dumps(parsed.to_dict(), ensure_ascii=False),
        "candidates_json": json.dumps([candidate.to_dict() for candidate in candidates], ensure_ascii=False),
        "llm_json": json.dumps(decision, ensure_ascii=False) if decision else None,
        "target_path": str(target) if target else None,
        "error": target_error,
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
    logger.info("Created job %s for %s", job_id, path)
    return db.get_job(job_id) or {}
