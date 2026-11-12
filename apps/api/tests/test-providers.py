from app.services.providers import Candidate, _score


def candidate(title: str, year: int | None = None) -> Candidate:
    return Candidate(
        provider="jellyfin",
        provider_id="1",
        title=title,
        year=year,
        overview="",
        image=None,
        kind="movie",
    )


def test_exact_title_scores_high():
    assert _score("Spirited Away", 2001, candidate("Spirited Away", 2001), 0) >= 90


def test_exact_short_title_beats_prefix_match():
    exact = _score("Dark", None, candidate("Dark", 2017), 1)
    prefix = _score("Dark", None, candidate("Dark Shadows", 1966), 0)
    assert exact > prefix
    assert prefix < 75


def test_unrelated_title_stays_below_threshold():
    assert _score("Some Movie", None, candidate("Home Movies"), 0) < 75
    assert _score("Tiny Movie", None, candidate("Tony Cairoli: The Movie"), 0) < 75
