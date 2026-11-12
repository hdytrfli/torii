from pathlib import Path

import pytest
import yaml

from app.core import deployment
from app.core.config import Config

REPO_ROOT = Path(__file__).resolve().parents[3]
CONFIG = REPO_ROOT / "config.yaml"
from app.domain import settings


def test_repository_config_is_valid():
    data = deployment.load()
    assert data["paths"]["watch"]["movies"] == "/downloads/movies"
    assert data["paths"]["watch"]["shows"] == "/downloads/shows"
    assert data["paths"]["library"]["shows"] == "/library/shows"
    assert data["scan"]["poll_interval"] >= 1
    assert data["apply"]["action"] == "move"
    assert "{season}" in data["layout"]["shows"]


def test_settings_seeded_from_yaml():
    defaults = settings.defaults()
    assert defaults["tv_template"].startswith("{title} ({year})/Season {season}")
    assert defaults["min_size_mb"] == "0.0"


def test_config_load_uses_yaml_and_env_secrets(monkeypatch):
    monkeypatch.setenv("JELLYFIN_URL", "https://jellyfin.nichi.my.id/")
    monkeypatch.setenv("JELLYFIN_API_KEY", "jellyfin-key")
    monkeypatch.setenv("LLM_BASE_URL", "https://opencode.ai/inference/openai/v1")
    monkeypatch.setenv("LLM_API_KEY", "llm-key")
    monkeypatch.setenv("LLM_MODEL", "deepseek-v4.1-flash")
    cfg = Config.load()
    assert cfg.jellyfin_url == "https://jellyfin.nichi.my.id"
    assert cfg.jellyfin_api_key == "jellyfin-key"
    assert cfg.llm_base_url == "https://opencode.ai/inference/openai/v1"
    assert cfg.llm_api_key == "llm-key"
    assert cfg.llm_model == "deepseek-v4.1-flash"


def test_unknown_key_is_rejected(tmp_path: Path):
    data = yaml.safe_load(CONFIG.read_text(encoding="utf-8"))
    data["scan"]["min_size"] = 10
    path = tmp_path / "bad.yaml"
    path.write_text(yaml.safe_dump(data), encoding="utf-8")
    with pytest.raises(deployment.ConfigError, match="unknown key"):
        deployment.load(path)


def test_bad_template_is_rejected(tmp_path: Path):
    data = yaml.safe_load(CONFIG.read_text(encoding="utf-8"))
    data["layout"]["shows"] = "{unknown}/Season {season}"
    path = tmp_path / "bad.yaml"
    path.write_text(yaml.safe_dump(data), encoding="utf-8")
    with pytest.raises(deployment.ConfigError, match="unknown placeholder"):
        deployment.load(path)
