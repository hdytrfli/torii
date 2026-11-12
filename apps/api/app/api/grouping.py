from __future__ import annotations

from typing import Any, Callable


def group_jobs(
    jobs: list[dict[str, Any]],
    serialize: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    serialize = serialize or (lambda job: job)
    grouped: dict[str, list[dict[str, Any]]] = {}
    for job in jobs:
        key = job.get("group_key") or f"job:{job['id']}"
        grouped.setdefault(key, []).append(job)

    result = []
    for key, group in grouped.items():
        first = group[0]
        group_type = first.get("group_type") or "movie"
        title = first.get("title") or "Unknown"
        year = first.get("year")
        if group_type == "collection":
            label = key.split(":", 1)[-1].split("/")[-1] or title
        else:
            label = f"{title} ({year})" if year else title

        sources = [item.get("source") for item in group if item.get("source")]
        result.append(
            {
                "key": key,
                "type": group_type,
                "label": label,
                "counts": _counts(group),
                "total": len(group),
                "confidence": min(
                    (float(item.get("confidence") or 0) for item in group),
                    default=0,
                ),
                "source": max(set(sources), key=sources.count) if sources else None,
                "jobs": [serialize(item) for item in group],
            }
        )

    result.sort(key=lambda item: item["jobs"][0].get("updated_at") or "", reverse=True)
    return result


def _counts(jobs: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for job in jobs:
        status = job.get("status") or "unknown"
        counts[status] = counts.get(status, 0) + 1
    return counts
