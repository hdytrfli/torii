import os
import time
from pathlib import Path

from app.core.config import Config
from app.core.db import DB
from app.domain import pipeline, settings as settings_mod
from app.services import apply
from app.services.providers import JellyfinProvider, LLM
from app.services.operations import OperationQueue
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
    operation = db.latest_operation(job["id"])
    assert operation is not None
    assert operation["kind"] == "move"
    assert operation["status"] == "committed"
    assert db.get_target_reservation(str(target))["job_id"] == job["id"]


def test_promotion_queue_moves_high_confidence_jobs_to_ready(tmp_path: Path):
    cfg = make_config(tmp_path)
    cfg.movie_watch_dir.mkdir(parents=True)
    source = cfg.movie_watch_dir / "Promoted.2024.mkv"
    source.write_bytes(b"x")
    db = DB(tmp_path / "state.db")
    settings_mod.save(
        db,
        {
            "min_size_mb": "0",
            "extensions": "mkv",
            "movie_template": "{title} ({year})/{title}",
            "tv_template": "{title} ({year})/{title}",
            "action": "move",
            "cleanup_empty_dirs": "on",
            "auto_apply": "on",
            "auto_apply_confidence": "0.85",
            "poll_interval": "30",
            "stable_seconds": "0",
        },
    )
    high_id = db.create_job(
        source,
        1,
        0,
        status="needs_review",
        title="Promoted",
        year=2024,
        media_type="movie",
        confidence=0.9,
    )
    low_source = cfg.movie_watch_dir / "Low.2024.mkv"
    low_source.write_bytes(b"x")
    low_id = db.create_job(
        low_source,
        1,
        0,
        status="needs_review",
        title="Low",
        year=2024,
        media_type="movie",
        confidence=0.5,
        target_path=str(cfg.movie_library_dir / "Low (2024)" / "Low.mkv"),
    )
    queue = OperationQueue(cfg, db)

    queue.promote_ready()

    assert db.get_job(high_id)["status"] == "ready"
    assert db.get_job(low_id)["status"] == "needs_review"


def test_durable_work_queue_claims_and_recovers(tmp_path: Path):
    db = DB(tmp_path / "state.db")
    source = tmp_path / "movie.mkv"
    source.write_bytes(b"x")
    job_id = db.create_job(
        source,
        1,
        0,
        status="analyzing",
        media_type="movie",
    )
    first = db.enqueue_work("metadata", job_id, max_attempts=3)
    second = db.enqueue_work("metadata", job_id, max_attempts=3)
    assert first == second

    claimed = db.claim_work("metadata", "worker-1", lease_seconds=60)
    assert claimed is not None
    assert claimed["status"] == "running"
    assert claimed["attempts"] == 1
    assert db.claim_work("metadata", "worker-2", lease_seconds=60) is None

    db.recover_running_work()
    claimed = db.claim_work("metadata", "worker-2", lease_seconds=60)
    assert claimed is not None
    assert claimed["attempts"] == 2
    db.complete_work(int(claimed["id"]))
    assert db.work_counts() == {}


def test_metadata_queue_processes_a_job(tmp_path: Path):
    cfg = make_config(tmp_path)
    cfg.movie_watch_dir.mkdir(parents=True)
    source = cfg.movie_watch_dir / "Queued.Metadata.2024.mkv"
    source.write_bytes(b"x")
    db = DB(tmp_path / "state.db")
    job_id = db.create_job(
        source,
        source.stat().st_size,
        source.stat().st_mtime,
        status="analyzing",
        media_type="movie",
    )
    db.enqueue_work("metadata", job_id, max_attempts=3)
    queue = OperationQueue(
        cfg, db, JellyfinProvider(None, None), LLM(None, None, None)
    )
    queue.start()
    try:
        deadline = time.time() + 5
        while time.time() < deadline:
            job = db.get_job(job_id) or {}
            if job.get("status") == "needs_review":
                break
            time.sleep(0.05)
        job = db.get_job(job_id) or {}
        assert job.get("status") == "needs_review"
        assert job.get("title") == "Queued Metadata"
    finally:
        queue.stop()


def test_revert_queue_restores_source(tmp_path: Path):
    cfg = make_config(tmp_path)
    cfg.movie_watch_dir.mkdir(parents=True)
    cfg.movie_library_dir.mkdir(parents=True)
    source = cfg.movie_watch_dir / "Revert.Me.2024.mkv"
    source.write_bytes(b"x")
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
        cfg, settings, db, job,
        job["title"], job["year"], job["media_type"],
        job["season"], job["episode"],
    )
    assert ok, message
    assert target is not None
    applied = db.get_job(job["id"]) or {}

    queue = OperationQueue(
        cfg, db, JellyfinProvider(None, None), LLM(None, None, None)
    )
    queue.start()
    try:
        queue.enqueue_revert(applied)
        deadline = time.time() + 5
        while time.time() < deadline:
            restored = db.get_job(job["id"]) or {}
            if restored.get("status") == "needs_review":
                break
            time.sleep(0.05)
        restored = db.get_job(job["id"]) or {}
        assert restored.get("status") == "needs_review"
        assert source.exists()
        assert not target.exists()
    finally:
        queue.stop()


def test_operation_queue_applies_asynchronously(tmp_path: Path):
    cfg = make_config(tmp_path)
    cfg.movie_watch_dir.mkdir(parents=True)
    cfg.movie_library_dir.mkdir(parents=True)
    source = cfg.movie_watch_dir / "Queued.2024.mkv"
    source.write_bytes(b"queued source")
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
    queue = OperationQueue(cfg, db)
    queue.start()
    try:
        operation_id = queue.enqueue_apply(
            job,
            job["title"],
            job["year"],
            job["media_type"],
            job["season"],
            job["episode"],
            settings.action,
        )
        deadline = time.time() + 5
        while time.time() < deadline:
            updated = db.get_job(job["id"]) or {}
            if updated.get("status") == "moved":
                break
            time.sleep(0.05)
        updated = db.get_job(job["id"]) or {}
        operation = db.get_operation(operation_id) or {}
        assert updated.get("status") == "moved"
        assert operation.get("status") == "committed"
    finally:
        queue.stop()


def test_undo_reverses_operation_and_releases_target(tmp_path: Path):
    cfg = make_config(tmp_path)
    cfg.movie_watch_dir.mkdir(parents=True)
    cfg.movie_library_dir.mkdir(parents=True)
    source = cfg.movie_watch_dir / "Undo.Me.2024.mkv"
    source.write_bytes(b"x")
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
        cfg, settings, db, job,
        job["title"], job["year"], job["media_type"],
        job["season"], job["episode"],
    )
    assert ok, message
    assert target is not None
    applied = db.get_job(job["id"]) or {}

    ok, message = apply.undo_job(cfg, settings, db, applied)

    assert ok, message
    restored = db.get_job(job["id"]) or {}
    assert restored["status"] == "needs_review"
    assert restored["target_path"] is None
    assert db.get_target_reservation(str(target)) is None
    operation = db.latest_operation(job["id"])
    assert operation is not None
    assert operation["status"] == "reversed"


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


def test_apply_blocks_duplicate_target(tmp_path: Path):
    cfg = make_config(tmp_path)
    cfg.movie_watch_dir.mkdir(parents=True)
    cfg.movie_library_dir.mkdir(parents=True)
    db = DB(tmp_path / "state.db")
    settings = settings_mod.load(db)
    first_source = cfg.movie_watch_dir / "Same.2024.one.mkv"
    second_source = cfg.movie_watch_dir / "Same.2024.two.mkv"
    first_source.write_bytes(b"1")
    second_source.write_bytes(b"2")
    target_path = str(cfg.movie_library_dir / "Same (2024)" / "Same.mkv")
    first_id = db.create_job(
        first_source,
        1,
        0,
        status="needs_review",
        title="Same",
        year=2024,
        media_type="movie",
        confidence=0.95,
        target_path=target_path,
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
        target_path=target_path,
        error="Duplicate target with Same.2024.one.mkv",
        auto_apply_eligible=0,
    )
    second = db.get_job(second_id) or {}
    first = db.get_job(first_id) or {}

    ok, message, _ = apply.apply_job(
        cfg, settings, db, second,
        second["title"], second["year"], second["media_type"],
        second["season"], second["episode"],
    )
    assert not ok
    assert "Duplicate target" in message

    ok, message, _ = apply.apply_job(
        cfg, settings, db, first,
        first["title"], first["year"], first["media_type"],
        first["season"], first["episode"],
    )
    assert ok, message


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
    assert duplicate["blocked_reason"] == "duplicate_target"
    assert duplicate["auto_apply_eligible"] == 0
    assert db.get_target_reservation(target)["job_id"] == first_id


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
    source = cfg.movie_watch_dir / "Spirited.Away.mkv"
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
    source = cfg.movie_watch_dir / "Unknown.Movie.mkv"
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
