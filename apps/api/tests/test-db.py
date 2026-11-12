from pathlib import Path

from app.core.db import DB


def test_job_lifecycle(tmp_path: Path):
    db = DB(tmp_path / "state.db")
    source = tmp_path / "movie.mkv"
    source.write_bytes(b"x")

    job_id = db.create_job(
        source,
        source.stat().st_size,
        source.stat().st_mtime,
        status="needs_review",
        title="Movie",
        year=2024,
        media_type="movie",
        confidence=0.5,
    )

    job = db.get_job(job_id)
    assert job["title"] == "Movie"
    assert job["status"] == "needs_review"

    db.update_job(job_id, status="moved", target_path="/library/movie.mkv")
    job = db.get_job(job_id)
    assert job["status"] == "moved"
    assert job["target_path"] == "/library/movie.mkv"

    assert db.stats()["moved"] == 1
    assert len(db.list_jobs("moved")) == 1
    assert len(db.list_jobs("needs_review")) == 0
