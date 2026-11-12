from pathlib import Path

from app.core.config import Config
from app.core.db import DB
from app.domain import nfo, pipeline, settings as settings_mod
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


def test_read_movie_nfo(tmp_path: Path):
    movie = tmp_path / "Film.mkv"
    movie.touch()
    (tmp_path / "movie.nfo").write_text(
        "<movie><title>Spirited Away</title><year>2001</year>"
        '<uniqueid type="tmdb">129</uniqueid></movie>',
        encoding="utf-8",
    )

    data = nfo.read(movie)
    assert data is not None
    assert data["kind"] == "movie"
    assert data["title"] == "Spirited Away"
    assert data["year"] == 2001
    assert data["provider_ids"] == {"tmdb": "129"}


def test_read_episode_nfo(tmp_path: Path):
    episode = tmp_path / "Episode.mkv"
    episode.touch()
    (tmp_path / "Episode.nfo").write_text(
        "<episodedetails><title>Pilot</title><showtitle>Dark</showtitle>"
        "<season>1</season><episode>1</episode></episodedetails>",
        encoding="utf-8",
    )

    data = nfo.read(episode)
    assert data is not None
    assert data["kind"] == "tv"
    assert data["title"] == "Dark"
    assert data["episode_title"] == "Pilot"
    assert data["season"] == 1
    assert data["episode"] == 1


def test_pipeline_prefers_local_nfo(tmp_path: Path):
    cfg = make_config(tmp_path)
    cfg.movie_watch_dir.mkdir(parents=True)
    source = cfg.movie_watch_dir / "Wrong.Name.1999.mkv"
    source.touch()
    (cfg.movie_watch_dir / "movie.nfo").write_text(
        "<movie><title>Spirited Away</title><year>2001</year>"
        '<uniqueid type="tmdb">129</uniqueid></movie>',
        encoding="utf-8",
    )

    db = DB(tmp_path / "state.db")
    job = pipeline.analyze(
        cfg,
        settings_mod.load(db),
        db,
        source,
        JellyfinProvider(None, None),
        LLM(None, None, None),
    )

    assert job["title"] == "Spirited Away"
    assert job["year"] == 2001
    assert job["media_type"] == "movie"
    assert job["confidence"] == 1.0
    assert job["source"] == "nfo"
    assert "NFO" in (job["reason"] or "")
    candidates = db.job_json(job)["candidates_json"]
    assert candidates[0]["provider"] == "nfo"
    assert candidates[0]["provider_id"] == "129"
