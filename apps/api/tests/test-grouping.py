from app.api.grouping import group_jobs


def job(job_id, title, year, group_key, group_type, source, status="needs_review"):
    return {
        "id": job_id,
        "title": title,
        "year": year,
        "group_key": group_key,
        "group_type": group_type,
        "source": source,
        "status": status,
        "confidence": 1.0 if source == "jellyfin" else 0.6,
        "updated_at": "2026-01-01T00:00:00+00:00",
    }


def test_show_group_aggregates_episodes():
    groups = group_jobs([
        job(1, "Dark", 2017, "show:dark|2017", "show", "jellyfin"),
        job(2, "Dark", 2017, "show:dark|2017", "show", "jellyfin", "ready"),
    ])
    assert len(groups) == 1
    group = groups[0]
    assert group["type"] == "show"
    assert group["label"] == "Dark (2017)"
    assert group["total"] == 2
    assert group["counts"] == {"needs_review": 1, "ready": 1}
    assert group["source"] == "jellyfin"


def test_collection_uses_folder_name_for_label():
    groups = group_jobs([
        job(1, "The Matrix", 1999, "collection:Matrix Collection", "collection", "guessit"),
        job(2, "The Matrix Reloaded", 2003, "collection:Matrix Collection", "collection", "guessit"),
    ])
    group = groups[0]
    assert group["type"] == "collection"
    assert group["label"] == "Matrix Collection"


def test_loose_movies_are_separate_groups():
    groups = group_jobs([
        job(1, "Spirited Away", 2001, "movie:spirited away|2001", "movie", "jellyfin"),
        job(2, "The Matrix", 1999, "movie:the matrix|1999", "movie", "jellyfin"),
    ])
    assert len(groups) == 2
    assert {group["type"] for group in groups} == {"movie"}
