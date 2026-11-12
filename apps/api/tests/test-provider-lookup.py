from app.services import providers
from app.services.providers import JellyfinProvider


class FakeResponse:
    status_code = 200
    text = ""

    def json(self):
        return [
            {
                "Name": "Spirited Away",
                "ProductionYear": 2001,
                "ProviderIds": {"Tmdb": "129", "Imdb": "tt0245429"},
            }
        ]


class FakeClient:
    calls = []

    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def post(self, url, json=None, headers=None):
        FakeClient.calls.append((url, json, headers))
        return FakeResponse()


def test_lookup_sends_provider_ids(monkeypatch):
    FakeClient.calls = []
    monkeypatch.setattr(providers.httpx, "Client", FakeClient)
    provider = JellyfinProvider("https://jellyfin.example", "secret")

    candidate = provider.lookup("tmdb", "129", "movie")

    assert candidate is not None
    assert candidate.title == "Spirited Away"
    assert candidate.year == 2001
    assert candidate.provider_id == "129"
    url, payload, headers = FakeClient.calls[0]
    assert url.endswith("/Items/RemoteSearch/Movie")
    assert payload["SearchInfo"]["ProviderIds"] == {"Tmdb": "129"}
    assert headers["Authorization"] == 'MediaBrowser Token="secret"'


def test_lookup_uses_series_endpoint(monkeypatch):
    FakeClient.calls = []
    monkeypatch.setattr(providers.httpx, "Client", FakeClient)
    provider = JellyfinProvider("https://jellyfin.example", "secret")

    provider.lookup("tvdb", "12345", "tv")

    assert FakeClient.calls[0][0].endswith("/Items/RemoteSearch/Series")
    assert FakeClient.calls[0][1]["SearchInfo"]["ProviderIds"] == {"Tvdb": "12345"}


def test_lookup_rejects_unknown_provider():
    provider = JellyfinProvider("https://jellyfin.example", "secret")
    assert provider.lookup("unknown", "1", "movie") is None
