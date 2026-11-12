from pathlib import Path

import pytest

from app import naming


def test_sanitize_removes_invalid_characters():
    assert naming.sanitize('Movie: Name/Part 1?') == "Movie NamePart 1"
    assert naming.sanitize("   ") == "Unknown"


def test_movie_target_uses_template():
    target = naming.target_for_movie(
        Path("/library/movies"),
        "{folder}/{folder} [{quality}]",
        "Spirited Away",
        2001,
        ".mkv",
    )
    assert str(target).replace("\\", "/").endswith(
        "library/movies/Spirited Away (2001)/Spirited Away (2001) [].mkv"
    )


def test_show_target_uses_episode_tag():
    target = naming.target_for_show(
        Path("/library/shows"),
        "{folder}/Season {season:02d}/{title} - {episode_tag}",
        "Show Name",
        2024,
        2,
        5,
        ".mkv",
    )
    assert str(target).replace("\\", "/").endswith(
        "library/shows/Show Name (2024)/Season 02/Show Name - S02E05.mkv"
    )


def test_show_target_uses_unpadded_custom_layout():
    target = naming.target_for_show(
        Path("/library/shows"),
        "{folder}/Season {season}/{title} - Season {season} Episode {episode}",
        "Dark",
        2017,
        2,
        5,
        ".mkv",
    )
    assert str(target).replace("\\", "/").endswith(
        "library/shows/Dark (2017)/Season 2/Dark - Season 2 Episode 5.mkv"
    )


def test_show_requires_season_and_episode():
    with pytest.raises(ValueError):
        naming.target_for_show(
            Path("/library/shows"),
            "{folder}/Season {season:02d}/{title} - {episode_tag}",
            "Show",
            2024,
            None,
            5,
            ".mkv",
        )


def test_template_cannot_escape_library():
    with pytest.raises(ValueError):
        naming.render(Path("/library"), "../outside/{title}", {"title": "x", "ext": "mkv"})
