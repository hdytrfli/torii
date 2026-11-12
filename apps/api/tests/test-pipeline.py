import os
from pathlib import Path

from app.core.config import Config
from app.core.db import DB
from app.domain import pipeline, settings as settings_mod
from app.services import apply
from app.services.providers import JellyfinProvider, LLM
from app.services.scanner import Scanner


def make_config(tmp_path: Path) -> Config:
    return Config(
        movie_watch_dir=tmp_path / "watch" / "movies",
        show_watch_dir=tmp_path / "watch" / "shows",
        movie_library_dir=tmp_path / "library" / "movies",
        show_library_dir=tmp_path / "library" / "shows",
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
    cfg.movie_watch_dir.mkdir(parents=True)
    source = cfg.movie_watch_dir / "Spirited.Away.2001.1080p.BluRay.x264-GROUP.mkv"
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
    assert job["source"] == "guessit"

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


def test_undo_with_missing_target_returns_job_to_review(tmp_path: Path):
    cfg = make_config(tmp_path)
    cfg.movie_watch_dir.mkdir(parents=True)
    source = cfg.movie_watch_dir / "Movie.2024.mkv"
    source.write_bytes(b"source")
    db = DB(tmp_path / "state.db")
    settings = settings_mod.load(db)
    job_id = db.create_job(
        source,
        source.stat().st_size,
        source.stat().st_mtime,
        status="moved",
        title="Movie",
        year=2024,
        media_type="movie",
        target_path=str(tmp_path / "library" / "missing.mkv"),
        auto_apply_eligible=1,
    )
    job = db.get_job(job_id) or {}

    ok, message = apply.undo_job(cfg, settings, db, job)

    assert ok, message
    restored = db.get_job(job_id) or {}
    assert restored["status"] == "needs_review"
    assert restored["target_path"] is None
    assert restored["auto_apply_eligible"] == 0
    assert source.exists()


def test_undo_with_missing_source_and_target_marks_failed(tmp_path: Path):
    cfg = make_config(tmp_path)
    db = DB(tmp_path / "state.db")
    settings = settings_mod.load(db)
    source = tmp_path / "gone.mkv"
    job_id = db.create_job(
        source,
        0,
        0,
        status="moved",
        title="Gone",
        media_type="movie",
        target_path=str(tmp_path / "library" / "gone.mkv"),
    )
    job = db.get_job(job_id) or {}

    ok, _ = apply.undo_job(cfg, settings, db, job)

    assert not ok
    restored = db.get_job(job_id) or {}
    assert restored["status"] == "failed"
    assert restored["error"] == "Source and target files are missing."


def test_scanner_marks_duplicate_targets(tmp_path: Path):
    cfg = make_config(tmp_path)
    cfg.movie_watch_dir.mkdir(parents=True)
    db = DB(tmp_path / "state.db")
    target = str(tmp_path / "library" / "movies" / "Same (2024)" / "Same.mkv")
    first_source = cfg.movie_watch_dir / "Same.2024.one.mkv"
    second_source = cfg.movie_watch_dir / "Same.2024.two.mkv"
    first_source.write_bytes(b"1")
    second_source.write_bytes(b"2")
    first_id = db.create_job(
        first_source,
        1,
        0,
        status="needs_review",
        title="Same",
        year=2024,
        media_type="movie",
        confidence=0.95,
        target_path=target,
    )
    second_id = db.create_job(
        second_source,
        1,
        0,
        status="needs_review",
        title="Same",
        year=2024,
        media_type="movie",
        confidence=0.95,
        target_path=target,
    )

    scanner = Scanner(cfg, db, JellyfinProvider(None, None), LLM(None, None, None))
    scanner._reconcile_jobs()

    assert db.get_job(first_id)["error"] is None
    duplicate = db.get_job(second_id)
    assert duplicate["error"].startswith("Duplicate target with ")
    assert duplicate["auto_apply_eligible"] == 0


def test_scanner_marks_missing_sources(tmp_path: Path):
    cfg = make_config(tmp_path)
    db = DB(tmp_path / "state.db")
    source = tmp_path / "watch" / "movies" / "Gone.2024.mkv"
    job_id = db.create_job(
        source,
        0,
        0,
        status="needs_review",
        title="Gone",
        year=2024,
        media_type="movie",
        target_path=str(tmp_path / "library" / "Gone (2024)" / "Gone.mkv"),
    )

    scanner = Scanner(cfg, db, JellyfinProvider(None, None), LLM(None, None, None))
    scanner._reconcile_jobs()

    job = db.get_job(job_id)
    assert job["status"] == "failed"
    assert job["error"] == "Source file is missing."
    assert job["auto_apply_eligible"] == 0


def test_delete_job_removes_source_and_record(tmp_path: Path):
    cfg = make_config(tmp_path)
    cfg.movie_watch_dir.mkdir(parents=True)
    source = cfg.movie_watch_dir / "Delete.Me.2024.mkv"
    source.write_bytes(b"x")
    db = DB(tmp_path / "state.db")
    settings = settings_mod.load(db)
    job_id = db.create_job(
        source,
        source.stat().st_size,
        source.stat().st_mtime,
        status="needs_review",
        title="Delete Me",
        media_type="movie",
    )
    job = db.get_job(job_id) or {}

    ok, message = apply.delete_job(cfg, settings, db, job)

    assert ok, message
    assert not source.exists()
    assert db.get_job(job_id) is None


class FakeJellyfin:
    enabled = True

    def __init__(self, candidates):
        self.candidates = candidates

    def search(self, title, year, kind):
        return list(self.candidates)


class FakeLLM:
    enabled = True

    def __init__(self, decision=None):
        self.decision = decision
        self.calls = 0

    def normalize(self, release, parsed, candidates):
        self.calls += 1
        return self.decision


def test_jellyfin_match_does_not_call_ai(tmp_path: Path):
    from app.services.providers import Candidate

    cfg = make_config(tmp_path)
    cfg.movie_watch_dir.mkdir(parents=True)
    source = cfg.movie_watch_dir / "Spirited.Away.2001.1080p.mkv"
    source.write_bytes(b"")
    db = DB(tmp_path / "state.db")
    llm = FakeLLM({"title": "Wrong AI Title", "year": 1999, "media_type": "movie"})
    jellyfin = FakeJellyfin([
        Candidate(
            provider="jellyfin",
            provider_id="129",
            title="Spirited Away",
            year=2001,
            overview="",
            image=None,
            kind="movie",
            score=100.0,
        )
    ])

    job = pipeline.analyze(cfg, settings_mod.load(db), db, source, jellyfin, llm)

    assert job["source"] == "jellyfin"
    assert job["title"] == "Spirited Away"
    assert llm.calls == 0


def test_ai_is_used_only_without_provider_candidates(tmp_path: Path):
    cfg = make_config(tmp_path)
    cfg.movie_watch_dir.mkdir(parents=True)
    source = cfg.movie_watch_dir / "Unknown.Movie.2020.mkv"
    source.write_bytes(b"")
    db = DB(tmp_path / "state.db")
    llm = FakeLLM({"title": "Resolved Movie", "year": 2020, "media_type": "movie", "reason": "AI"})
    jellyfin = FakeJellyfin([])

    job = pipeline.analyze(cfg, settings_mod.load(db), db, source, jellyfin, llm)

    assert job["source"] == "llm"
    assert job["title"] == "Resolved Movie"
    assert llm.calls == 1


def test_copy_action_keeps_source(tmp_path: Path):
    cfg = make_config(tmp_path)
    cfg.movie_watch_dir.mkdir(parents=True)
    source = cfg.movie_watch_dir / "Spirited.Away.2001.1080p.mkv"
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
        action="copy",
    )

    assert ok, message
    assert source.exists()
    assert target is not None and target.exists()
    assert db.get_job(job["id"])["status"] == "moved"


def test_hardlink_action_links_source(tmp_path: Path):
    cfg = make_config(tmp_path)
    cfg.movie_watch_dir.mkdir(parents=True)
    source = cfg.movie_watch_dir / "Spirited.Away.2001.1080p.mkv"
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
        action="hardlink",
    )

    assert ok, message
    assert "Linked" in message
    assert source.exists()
    assert target is not None and target.exists()
    assert os.path.samefile(source, target)


def test_undo_move_restores_source(tmp_path: Path):
    cfg = make_config(tmp_path)
    cfg.movie_watch_dir.mkdir(parents=True)
    source = cfg.movie_watch_dir / "Spirited.Away.2001.1080p.mkv"
    source.write_bytes(b"")
    db = DB(tmp_path / "state.db")
    settings = settings_mod.load(db)
    job = pipeline.analyze(cfg, settings, db, source, JellyfinProvider(None, None), LLM(None, None, None))
    ok, _, target = apply.apply_job(cfg, settings, db, job, job["title"], job["year"], job["media_type"], job["season"], job["episode"], action="move")
    assert ok and target and target.exists() and not source.exists()

    ok, message = apply.undo_job(cfg, settings, db, db.get_job(job["id"]))
    assert ok, message
    assert source.exists()
    assert not target.exists()
    assert not target.parent.exists()
    assert not target.parent.exists()
    assert db.get_job(job["id"])["status"] == "needs_review"


def test_undo_copy_removes_target_and_keeps_source(tmp_path: Path):
    cfg = make_config(tmp_path)
    cfg.movie_watch_dir.mkdir(parents=True)
    source = cfg.movie_watch_dir / "Spirited.Away.2001.1080p.mkv"
    source.write_bytes(b"")
    db = DB(tmp_path / "state.db")
    settings = settings_mod.load(db)
    job = pipeline.analyze(cfg, settings, db, source, JellyfinProvider(None, None), LLM(None, None, None))
    ok, _, target = apply.apply_job(cfg, settings, db, job, job["title"], job["year"], job["media_type"], job["season"], job["episode"], action="copy")
    assert ok and target and target.exists() and source.exists()

    ok, message = apply.undo_job(cfg, settings, db, db.get_job(job["id"]))
    assert ok, message
    assert source.exists()
    assert not target.exists()
