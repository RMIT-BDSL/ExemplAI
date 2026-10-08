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
    # OpenRouter (OpenAI-compatible) replaces OpenAI as the agent's LLM route.
    # Supply OPENROUTER_API_KEY to use it; OPENROUTER_MODEL defaults to DeepSeek
    # V4.1 Flash (newer, faster and cheaper than V4 Flash 0731).
    OPENROUTER_API_KEY: SecretStr = SecretStr("")
    OPENROUTER_MODEL: str = "deepseek/deepseek-v4.1-flash"
    OPENROUTER_ENABLED: bool = True
    # Speed settings (ai/llm/openrouter.py). Two roles: "agent" writes the
    # tutor's replies (example / control agents); "check" is the input
    # guardrail and the Dean, which only classify.
    # Provider order: "throughput", "latency" or "price"; "" = OpenRouter's
    # default, which favours the cheapest (often slowest) providers.
    OPENROUTER_PROVIDER_SORT: str = "throughput"
    # Only route to providers that support every parameter sent (the checks
    # need structured output).
    OPENROUTER_REQUIRE_PARAMETERS: bool = True
    # Reasoning effort: none, minimal, low, medium, high, xhigh or max; "" =
    # the model's default (which may think at length before answering). The
    # checks include the Dean's answer-leak judgement, so "none" there should
    # only follow a quality check.
    OPENROUTER_AGENT_REASONING: str = "low"
    OPENROUTER_CHECK_REASONING: str = "low"
    # The Faded example agent's own effort ("" = OPENROUTER_AGENT_REASONING).
    # Medium placed blanks no better than low (75% each, 102 examples per
    # setting, server/eval, 2026-10-07), so it follows the agent's.
    OPENROUTER_FADED_REASONING: str = ""
    # Output token caps, reasoning included; 0 = no cap. Only a guard against
    # runaway output: set far above anything measured (server/eval, 2026-10-07:
    # agents <= 3,600, checks <= 1,800 tokens), because a cap that cuts off the
    # reasoning loses the whole reply (a 1,000-token check cap did, 3% of replies).
    OPENROUTER_AGENT_MAX_TOKENS: int = 16384
    OPENROUTER_CHECK_MAX_TOKENS: int = 8192
    # A different model for the checks ("" = OPENROUTER_MODEL). gpt-oss-120b
    # (on fast providers, reasoning low) judged 60 planted drafts as accurately
    # as the best models, in ~0.6 s against ~1.9 s for V4.1 Flash (server/eval,
    # 2026-10-07).
    OPENROUTER_CHECK_MODEL: str = "openai/gpt-oss-120b"

    # ── Chat features ──────────────────────────────────────────────────
    # Runnable code blocks in the chat (web: VITE_RUNNABLE_CHAT_CODE). Off: the
    # Erroneous tutor doesn't tell students to edit the example and press Run.
    RUNNABLE_CHAT_CODE: bool = False

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
    # Set by Railway on GitHub deploys; tags research records with the build.
    RAILWAY_GIT_COMMIT_SHA: str = ""


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

    # The models and speed settings actually in use (env vars override the
    # defaults above, e.g. on Railway), so a deploy log shows what runs.
    if settings.OPENROUTER_ENABLED:
        log.info(
            "llm — agent=%s check=%s provider_sort=%s require_parameters=%s "
            "reasoning(agent/faded/check)=%s/%s/%s max_tokens(agent/check)=%s/%s",
            settings.OPENROUTER_MODEL or "(empty!)",
            settings.OPENROUTER_CHECK_MODEL or settings.OPENROUTER_MODEL or "(empty!)",
            settings.OPENROUTER_PROVIDER_SORT or "openrouter-default",
            settings.OPENROUTER_REQUIRE_PARAMETERS,
            settings.OPENROUTER_AGENT_REASONING or "model-default",
            settings.OPENROUTER_FADED_REASONING or settings.OPENROUTER_AGENT_REASONING or "model-default",
            settings.OPENROUTER_CHECK_REASONING or "model-default",
            settings.OPENROUTER_AGENT_MAX_TOKENS or "none",
            settings.OPENROUTER_CHECK_MAX_TOKENS or "none",
        )
        if not settings.OPENROUTER_MODEL:
            log.warning("config — OPENROUTER_MODEL is set but empty; every LLM call will fail. "
                        "Remove the variable to use the default.")

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

