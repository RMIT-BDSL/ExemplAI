"""OpenRouter speed settings: what each role sends (ai/llm/openrouter.py)."""

import os

os.environ.setdefault("OPENAI_API_KEY", "test")  # ai.llm builds an OpenAI client at import

import ai.llm.openrouter as openrouter
from config import settings


def test_defaults_route_to_fast_providers_with_low_reasoning():
    for role in ("agent", "check"):
        opts = openrouter.request_options(role)
        assert opts["provider"] == {"sort": "throughput", "require_parameters": True}
        assert opts["reasoning"] == {"effort": "low"}
    assert openrouter.request_options("agent")["max_tokens"] == 16384
    assert openrouter.request_options("check")["max_tokens"] == 8192


def test_default_model_is_v4_1_flash():
    assert settings.OPENROUTER_MODEL == "deepseek/deepseek-v4.1-flash"


def test_empty_settings_fall_back_to_openrouter_defaults(monkeypatch):
    monkeypatch.setattr(settings, "OPENROUTER_PROVIDER_SORT", "")
    monkeypatch.setattr(settings, "OPENROUTER_REQUIRE_PARAMETERS", False)
    monkeypatch.setattr(settings, "OPENROUTER_CHECK_REASONING", "")
    monkeypatch.setattr(settings, "OPENROUTER_CHECK_MAX_TOKENS", 0)
    assert openrouter.request_options("check") == {}


def test_check_role_uses_its_own_model(monkeypatch):
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", settings.OPENROUTER_API_KEY.__class__("k"))
    assert openrouter.build_llm("check").model_name == "openai/gpt-oss-120b"  # the default
    monkeypatch.setattr(settings, "OPENROUTER_CHECK_MODEL", "")
    assert openrouter.build_llm("check").model_name == "deepseek/deepseek-v4.1-flash"
    monkeypatch.setattr(settings, "OPENROUTER_CHECK_MODEL", "google/gemini-flash-test")
    assert openrouter.build_llm("check").model_name == "google/gemini-flash-test"
    assert openrouter.build_llm("agent").model_name == "deepseek/deepseek-v4.1-flash"


def test_options_reach_the_request_body_including_structured_output(monkeypatch):
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", settings.OPENROUTER_API_KEY.__class__("k"))
    payload = openrouter.build_llm("check")._get_request_payload([("user", "hi")])
    assert payload["extra_body"]["provider"]["sort"] == "throughput"
    assert payload["extra_body"]["max_tokens"] == 8192
    assert "max_completion_tokens" not in payload  # OpenRouter documents max_tokens
