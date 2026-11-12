from pathlib import Path

from app import apply, pipeline, settings as settings_mod
from app.config import Config
from app.db import DB
from app.providers import JellyfinProvider, LLM


def make_config(tmp_path: Path) -> Config:
    return Config(
        watch_dir=tmp_path / "watch",
        library_dir=tmp_path / "library",
        state_dir=tmp_path / "state",
        host="127.0.0.1",
        port=8000,
        log_level="INFO",
        session_days=30,
        jellyfin_url=None,
        jellyfin_api_key=None,
        llm_base_url=None,
        llm_api_key=None,
        llm_model=None,
        notify_url=None,
        post_action_cmd=None,
    )


def test_analyze_and_move(tmp_path: Path):
    cfg = make_config(tmp_path)
    cfg.watch_dir.mkdir()
    source = cfg.watch_dir / "Spirited.Away.2001.1080p.BluRay.x264-GROUP.mkv"
    source.write_bytes(b"")
    db = DB(tmp_path / "state.db")
    settings = settings_mod.load(db)

    job = pipeline.analyze(
        cfg,
        settings,
        db,
        source,
        JellyfinProvider(None, None),
        LLM(None, None, None),
    )

    assert job["title"] == "Spirited Away"
    assert job["year"] == 2001
    assert job["media_type"] == "movie"
    assert job["status"] == "needs_review"

    ok, message, target = apply.apply_job(
        cfg,
        settings,
        db,
        job,
        job["title"],
        job["year"],
        job["media_type"],
        job["season"],
        job["episode"],
    )

    assert ok, message
    assert target is not None and target.exists()
    assert not source.exists()
    assert db.get_job(job["id"])["status"] == "moved"
