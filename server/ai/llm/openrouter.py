"""Chat models via OpenRouter (OpenAI-compatible): DeepSeek V4.1 Flash writes the
replies and gpt-oss-120b checks them, by default.

Accessed through ai.llm (``llm`` / ``check_llm``). Stays inert — no key is read
and no model is bound until the selector activates it (see ai/llm/__init__.py,
driven by settings.OPENROUTER_ENABLED).

Roles with their own speed settings (config.py, OPENROUTER_*):
- "agent": the example and control agents, which write the tutor's replies;
- "faded": the Faded example agent: the agent's model and cap, with its own
  reasoning effort (OPENROUTER_FADED_REASONING, by default the agent's);
- "check": the input guardrail and the Dean, which only classify.
"""

from typing import Literal

from langchain_openai import ChatOpenAI

from config import settings

Role = Literal["agent", "faded", "check"]


def request_options(role: Role) -> dict:
    """OpenRouter request fields for a role: provider routing, reasoning effort
    and output cap. Sent as extra body fields; max_tokens goes here because
    ChatOpenAI would send it as max_completion_tokens."""
    s = settings
    writes = role != "check"
    if role == "faded":
        effort = s.OPENROUTER_FADED_REASONING or s.OPENROUTER_AGENT_REASONING
    else:
        effort = s.OPENROUTER_AGENT_REASONING if writes else s.OPENROUTER_CHECK_REASONING
    max_tokens = s.OPENROUTER_AGENT_MAX_TOKENS if writes else s.OPENROUTER_CHECK_MAX_TOKENS

    options: dict = {}
    provider: dict = {}
    if s.OPENROUTER_PROVIDER_SORT:
        provider["sort"] = s.OPENROUTER_PROVIDER_SORT
    if s.OPENROUTER_REQUIRE_PARAMETERS:
        provider["require_parameters"] = True
    if provider:
        options["provider"] = provider
    if effort:
        options["reasoning"] = {"effort": effort}
    if max_tokens > 0:
        options["max_tokens"] = max_tokens
    return options


def build_llm(role: Role = "agent") -> ChatOpenAI:
    """Build the OpenRouter-backed chat model for a role from central settings."""
    model = settings.OPENROUTER_MODEL
    if role == "check" and settings.OPENROUTER_CHECK_MODEL:
        model = settings.OPENROUTER_CHECK_MODEL
    return ChatOpenAI(
        model=model,
        api_key=settings.OPENROUTER_API_KEY.get_secret_value(),
        base_url="https://openrouter.ai/api/v1",
        extra_body=request_options(role) or None,
    )
