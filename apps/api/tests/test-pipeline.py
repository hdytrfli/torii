from pathlib import Path

from app.core.config import Config
from app.core.db import DB
from app.domain import pipeline, settings as settings_mod
from app.services import apply
from app.services.providers import JellyfinProvider, LLM


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
