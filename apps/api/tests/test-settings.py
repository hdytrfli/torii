from pathlib import Path

from app.core.db import DB
from app.domain import settings as settings_mod


def test_settings_roundtrip(tmp_path: Path):
    db = DB(tmp_path / "state.db")
    settings = settings_mod.load(db)
    assert settings.action == "move"
    assert "mkv" in settings.extensions

    saved = settings_mod.save(db, {
        "min_size_mb": "0",
        "extensions": "mkv, mp4",
        "movie_template": "{title} ({year})/{title} ({year})",
        "tv_template": "{folder}/Season {season:02d}/{title} - {episode_tag}",
        "action": "copy",
        "delete_source": "on",
        "cleanup_empty_dirs": "on",
        "auto_apply": "on",
        "auto_apply_confidence": "0.9",
        "poll_interval": "30",
        "stable_seconds": "5",
    })

    assert saved.min_size_mb == 0
    assert saved.extensions == ("mkv", "mp4")
    assert saved.action == "copy"
    assert saved.delete_source is True
    assert saved.auto_apply is True
    assert saved.poll_interval == 30


def test_unknown_placeholder_rejected(tmp_path: Path):
    db = DB(tmp_path / "state.db")
    try:
        settings_mod.save(db, {
            "min_size_mb": "0",
            "extensions": "mkv",
            "movie_template": "{unknown}/{title}",
            "tv_template": "{folder}/{title}",
            "action": "move",
            "auto_apply_confidence": "0.8",
            "poll_interval": "60",
            "stable_seconds": "120",
        })
    except ValueError as exc:
        assert "unknown placeholder" in str(exc)
    else:
        raise AssertionError("expected ValueError")
