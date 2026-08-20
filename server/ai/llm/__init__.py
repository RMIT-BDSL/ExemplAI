"""LLM selector — OpenRouter is the agent's LLM route by default.

Exposes a single ``llm`` that nodes import from. ``llm`` is a lazy proxy: the
underlying chat model is only constructed on first use. That lets the server
boot even before ``OPENROUTER_API_KEY`` is configured; once a key is present in
env, ``build_llm()`` resolves to the actual model. Set
``settings.OPENROUTER_ENABLED=false`` to fall back to the OpenAI model. Pure
runtime switch, no node-level code changes.
"""

from ai.llm import openrouter
from ai.llm.openai import llm as _openai
from config import settings


class _LazyLlm:
    """Builds and caches the active chat model on first attribute access."""

    def __init__(self):
        self._model = None

    def _resolve(self):
        if self._model is None:
            if settings.OPENROUTER_ENABLED:
                self._model = openrouter.build_llm()
            else:
                self._model = _openai
        return self._model

    def __getattr__(self, name: str):
        return getattr(self._resolve(), name)


llm = _LazyLlm()