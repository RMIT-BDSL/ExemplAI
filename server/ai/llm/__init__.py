"""LLM selector — OpenAI by default, OpenRouter as an additional route behind it.

Exposes a single ``llm`` that nodes import from. While
``settings.OPENROUTER_ENABLED`` is false (the default), ``get_llm()`` returns the
existing OpenAI model and the OpenRouter route is never bound — so no
OPENROUTER_API_KEY is required. Setting OPENROUTER_ENABLED=true routes every node
through OpenRouter instead. Pure runtime switch, no node-level code changes.
"""

from ai.llm import openrouter
from ai.llm.openai import llm as _openai
from config import settings


def get_llm():
    """Return the active chat model for the agent (OpenAI or OpenRouter)."""
    if settings.OPENROUTER_ENABLED:
        return openrouter.build_llm()
    return _openai


llm = get_llm()