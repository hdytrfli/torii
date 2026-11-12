from pathlib import Path

from app.guess import parse


def test_parse_movie():
    parsed = parse(Path("Spirited.Away.2001.1080p.BluRay.x264-GROUP.mkv"))
    assert parsed.title == "Spirited Away"
    assert parsed.year == 2001
    assert parsed.kind == "movie"
    assert parsed.quality == "1080p"


def test_parse_show_episode():
    parsed = parse(Path("Show.Name.S02E05.1080p.WEB.H264-GROUP.mkv"))
    assert parsed.title == "Show Name"
    assert parsed.season == 2
    assert parsed.episode == 5
    assert parsed.kind == "tv"


def test_parse_multi_episode():
    parsed = parse(Path("Show.Name.S01E01-E02.1080p.WEB.H264-GROUP.mkv"))
    assert parsed.season == 1
    assert parsed.episode == 1
    assert parsed.episode_end == 2
