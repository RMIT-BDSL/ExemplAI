"""
Central settings — every environment variable the server reads is declared here.

Usage:
    from config import settings

    settings.JUDGE0_ENDPOINT                 # plain value (non-secret)
    settings.OPENAI_API_KEY.get_secret_value()  # unwrap a secret deliberately

One ``settings`` singleton is built at import time from the process environment
and ``server/.env`` (pydantic-settings reads the file directly). ``load_dotenv``
is still called so libraries that read ``os.environ`` themselves — notably
LangChain's ``init_chat_model`` looking up ``OPENAI_API_KEY`` — keep working.

Secrets are typed ``SecretStr``: they render as ``'**********'`` in logs,
tracebacks, ``repr()``, and ``/docs`` dumps, so a key can never leak into Sentry
or Langfuse by accident. Unwrap only at the point of use with
``.get_secret_value()``. Non-secret config (URLs, hosts, flags) stays ``str``.

Adapted from agent-service's central-settings pattern, implemented with
pydantic-settings (the FastAPI-idiomatic choice) so types are parsed and
validated for free.
"""

from __future__ import annotations

import logging

from dotenv import load_dotenv
from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

log = logging.getLogger("rich")

# Populate os.environ for libraries that read it directly (e.g. LangChain).
load_dotenv()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── LLM ────────────────────────────────────────────────────────────
    OPENAI_API_KEY: SecretStr = SecretStr("")
    # OpenRouter (OpenAI-compatible) can be selected as an additional route
    # behind OpenAI by setting OPENROUTER_ENABLED=true and an API key.
    OPENROUTER_API_KEY: SecretStr = SecretStr("")
    OPENROUTER_MODEL: str = "deepseek/deepseek-v4-flash-0731"
    OPENROUTER_ENABLED: bool = False

    # ── Code execution (Judge0) ────────────────────────────────────────
    JUDGE0_ENDPOINT: str = ""
    JUDGE0_AUTH_KEY: SecretStr = SecretStr("")
    IS_RAPIDAPI: bool = False
    RAPIDAPI_KEY: SecretStr = SecretStr("")
    RAPIDAPI_HOST: str = ""

    # ── Persistence ────────────────────────────────────────────────────
    DATABASE_URL: SecretStr = SecretStr("")  # contains DB credentials
    SUPABASE_URL: str = ""
    SUPABASE_PUBLIC_KEY: str = ""            # anon key — public by design
    SUPABASE_SECRET_KEY: SecretStr = SecretStr("")  # service-role key
    CONVEX_URL: str = ""
    CONVEX_BACKEND_SECRET: SecretStr = SecretStr("")

    # ── Observability ──────────────────────────────────────────────────
    SENTRY_DSN: SecretStr = SecretStr("")          # DSN embeds a project key
    SENTRY_TRACES_SAMPLE_RATE: float = 1.0
    LANGFUSE_PUBLIC_KEY: str = ""                   # public by design
    LANGFUSE_SECRET_KEY: SecretStr = SecretStr("")
    POSTHOG_PROJECT_TOKEN: str = ""
    POSTHOG_HOST: str = "https://eu.posthog.com"


# ── Singleton — import this everywhere ────────────────────────────────
settings = Settings()


def _is_set(value: object) -> bool:
    """True when a field carries a real value (handles SecretStr and str)."""
    if isinstance(value, SecretStr):
        return bool(value.get_secret_value())
    return bool(value)


def log_config_summary() -> None:
    """Log which integrations are configured — booleans only, never values.

    Call once at startup AFTER logging handlers are configured. Missing
    secrets are surfaced so a misconfigured deploy is obvious in the logs
    without ever printing the secret itself.
    """
    log.info(
        "config loaded — openai=%s openrouter=%s judge0=%s rapidapi=%s supabase=%s "
        "database_url=%s sentry=%s langfuse=%s convex_url=%s",
        _is_set(settings.OPENAI_API_KEY),
        settings.OPENROUTER_ENABLED and _is_set(settings.OPENROUTER_API_KEY),
        _is_set(settings.JUDGE0_ENDPOINT),
        settings.IS_RAPIDAPI,
        _is_set(settings.SUPABASE_URL) and _is_set(settings.SUPABASE_SECRET_KEY),
        _is_set(settings.DATABASE_URL),
        _is_set(settings.SENTRY_DSN),
        _is_set(settings.LANGFUSE_PUBLIC_KEY) and _is_set(settings.LANGFUSE_SECRET_KEY),
        _is_set(settings.CONVEX_URL),
    )

    if not _is_set(settings.OPENAI_API_KEY):
        log.warning("config — OPENAI_API_KEY is not set; LLM calls will fail")
    if settings.OPENROUTER_ENABLED and not _is_set(settings.OPENROUTER_API_KEY):
        log.warning(
            "config — OPENROUTER_ENABLED is true but OPENROUTER_API_KEY is not set; "
            "OpenRouter route will fail"
        )
    if not _is_set(settings.JUDGE0_ENDPOINT):
        log.warning("config — JUDGE0_ENDPOINT is not set; /execute will return 500")
    if not _is_set(settings.CONVEX_URL):
        log.warning("config — CONVEX_URL is not set; backend security authentication checks will fail")

