"""Token usage and cost per tutor reply (research and running-cost metric).

A ``UsageTracker`` goes in the graph run's callbacks (services/chat.py), so it
sees every model call made for one reply: the input guardrail, the agent, the
Dean and any Dean retry. OpenRouter reports tokens and the actual cost of each
call; the totals are saved on the tutor's message in Convex (chatMessages.usage).
"""

import threading
from typing import Any, Optional

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult


class UsageTracker(BaseCallbackHandler):
    """Collects the usage of every chat-model call made while it's attached."""

    def __init__(self) -> None:
        self.calls: list[dict] = []
        self._lock = threading.Lock()  # sync nodes run in worker threads

    def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        for generations in response.generations:
            for generation in generations:
                message = getattr(generation, "message", None)
                if message is None:
                    continue
                usage = getattr(message, "usage_metadata", None) or {}
                meta = getattr(message, "response_metadata", None) or {}
                raw = meta.get("token_usage") or (response.llm_output or {}).get("token_usage") or {}
                if not usage and not raw:
                    continue
                call = {
                    "model": meta.get("model_name") or (response.llm_output or {}).get("model_name") or "unknown",
                    "input_tokens": int(usage.get("input_tokens") or raw.get("prompt_tokens") or 0),
                    "output_tokens": int(usage.get("output_tokens") or raw.get("completion_tokens") or 0),
                    "reasoning_tokens": int((usage.get("output_token_details") or {}).get("reasoning") or 0),
                    "cached_tokens": int((usage.get("input_token_details") or {}).get("cache_read") or 0),
                    # OpenRouter's charge for the call in USD (absent on other routes).
                    "cost_usd": float(raw["cost"]) if isinstance(raw.get("cost"), (int, float)) else None,
                }
                with self._lock:
                    self.calls.append(call)

    def summary(self) -> Optional[dict]:
        """Totals for the reply, plus a row per model; None if no call reported usage."""
        with self._lock:
            calls = list(self.calls)
        if not calls:
            return None
        fields = ("input_tokens", "output_tokens", "reasoning_tokens", "cached_tokens")

        def total(rows: list[dict]) -> dict:
            out: dict = {f: sum(r[f] for r in rows) for f in fields}
            costs = [r["cost_usd"] for r in rows if r["cost_usd"] is not None]
            if costs:
                out["cost_usd"] = round(sum(costs), 8)
            out["calls"] = len(rows)
            return out

        models = sorted({c["model"] for c in calls})
        return {
            **total(calls),
            "by_model": [{"model": m, **total([c for c in calls if c["model"] == m])} for m in models],
        }
