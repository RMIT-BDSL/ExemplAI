"""Chat with DeepSeek V4 Flash via OpenRouter (OpenAI-compatible) as llm.

Accessed through ai.llm.get_llm(). Stays inert — no key is read and no model is
bound until the selector activates it (see ai/llm/__init__.py, driven by
settings.OPENROUTER_ENABLED).
"""

from langchain_openai import ChatOpenAI

from config import settings


def build_llm() -> ChatOpenAI:
    """Build the OpenRouter-backed chat model from central settings."""
    return ChatOpenAI(
        model=settings.OPENROUTER_MODEL,
        api_key=settings.OPENROUTER_API_KEY.get_secret_value(),
        base_url="https://openrouter.ai/api/v1",
    )