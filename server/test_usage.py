"""Token usage per tutor reply (ai/usage.py)."""

from langchain_core.messages import AIMessage
from langchain_core.outputs import ChatGeneration, LLMResult

from ai.usage import UsageTracker


def _result(model: str, inp: int, out: int, cost=None, reasoning=0, cached=0) -> LLMResult:
    raw = {"prompt_tokens": inp, "completion_tokens": out, **({"cost": cost} if cost is not None else {})}
    message = AIMessage(
        content="x",
        usage_metadata={
            "input_tokens": inp, "output_tokens": out, "total_tokens": inp + out,
            "input_token_details": {"cache_read": cached}, "output_token_details": {"reasoning": reasoning},
        },
        response_metadata={"model_name": model, "token_usage": raw},
    )
    return LLMResult(generations=[[ChatGeneration(message=message)]])


def test_sums_every_call_and_splits_by_model():
    t = UsageTracker()
    t.on_llm_end(_result("check", 100, 10, cost=0.001, reasoning=5))
    t.on_llm_end(_result("agent", 1000, 200, cost=0.002, cached=500))
    t.on_llm_end(_result("check", 300, 20, cost=0.003))
    s = t.summary()
    assert (s["input_tokens"], s["output_tokens"], s["calls"]) == (1400, 230, 3)
    assert (s["reasoning_tokens"], s["cached_tokens"]) == (5, 500)
    assert abs(s["cost_usd"] - 0.006) < 1e-12
    assert [(m["model"], m["calls"], m["input_tokens"]) for m in s["by_model"]] == [("agent", 1, 1000), ("check", 2, 400)]


def test_cost_left_out_when_the_route_reports_none():
    t = UsageTracker()
    t.on_llm_end(_result("m", 10, 1))
    assert "cost_usd" not in t.summary()


def test_no_calls_means_no_summary():
    assert UsageTracker().summary() is None
