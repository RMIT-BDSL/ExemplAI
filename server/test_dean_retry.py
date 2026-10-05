"""Dean: narrow answer-leak rule for short exercises, and one retry before the fallback.

Runs the real tutor graph with a MemorySaver checkpointer and a fake LLM."""

import importlib
import os

os.environ.setdefault("OPENAI_API_KEY", "test")  # ai.llm builds an OpenAI client at import

from langchain_core.messages import AIMessage
from langgraph.checkpoint.memory import MemorySaver

import ai.nodes.complete_ebl_node as complete_mod
import ai.nodes.dean_validation as dean_mod
from ai.graph import build_tutor_graph
from ai.nodes.context import student_context
from ai.nodes.dean_validation import DeanValidationResult, _FALLBACK
from ai.nodes.input_guardrail import GuardrailResult
from model.chat import Chat
from services.chat import build_initial_state

guardrail_mod = importlib.import_module("ai.nodes.input_guardrail")  # name shadowed by the function

HELP = [{"sender": "user", "content": "Please provide me an example to help me with this"}]


class _FakeLlm:
    """Agent drafts come from `drafts`; Dean verdicts from `verdicts`, in order."""

    def __init__(self, drafts, verdicts):
        self.drafts, self.verdicts, self.agent_calls = list(drafts), list(verdicts), []

    def invoke(self, messages):
        self.agent_calls.append(messages)
        return AIMessage(content=self.drafts.pop(0))

    def with_structured_output(self, schema):
        fake = self

        class _S:
            def invoke(self, messages):
                if schema is GuardrailResult:
                    return GuardrailResult(classification="SAFE", confidence=1.0)
                return fake.verdicts.pop(0)

        return _S()


def _run(monkeypatch, drafts, verdicts):
    fake = _FakeLlm(drafts, verdicts)
    for mod in (guardrail_mod, complete_mod, dean_mod):
        monkeypatch.setattr(mod, "llm", fake)
    graph = build_tutor_graph().compile(checkpointer=MemorySaver())
    chat = Chat(user_id=1, chat_id="c", conversation=[], bkt_prob_mastery=0.15,
                original_problem="Write helloWorld() that returns 'Hello World!'", trigger="get_help")
    out = graph.invoke(build_initial_state(chat, HELP), {"configurable": {"thread_id": "t"}})
    return out, fake


REJECT = DeanValidationResult(status="rejected", reason="DIRECT_ANSWER_LEAK", violation_excerpt="return 'Hello World!'")
APPROVE = DeanValidationResult(status="approved")


def test_first_rejection_is_retried_with_the_deans_reason(monkeypatch):
    out, fake = _run(monkeypatch, ["[NEW_EXAMPLE]\nreturn 'Hello World!'", "[NEW_EXAMPLE]\nreturn 'Good morning!'"],
                     [REJECT, APPROVE])
    assert out["messages"][-1].content == "return 'Good morning!'"
    assert out["dean_decision"] == "approved_after_retry" and out["dean_reason"] == "DIRECT_ANSWER_LEAK"
    assert len(fake.agent_calls) == 2
    retry_context = fake.agent_calls[1][1].content
    assert "<dean_feedback>" in retry_context and "DIRECT_ANSWER_LEAK: return 'Hello World!'" in retry_context
    assert "<dean_feedback>" not in fake.agent_calls[0][1].content


def test_second_rejection_sends_the_fallback(monkeypatch):
    out, fake = _run(monkeypatch, ["[NEW_EXAMPLE]\na", "[NEW_EXAMPLE]\nb"], [REJECT, REJECT])
    assert out["messages"][-1].content == _FALLBACK
    assert out["dean_decision"] == "rejected" and out["delivered_response_type"] == "fallback"
    assert len(fake.agent_calls) == 2  # exactly one retry


def test_approved_first_time_needs_no_retry(monkeypatch):
    out, fake = _run(monkeypatch, ["[NEW_EXAMPLE]\nreturn 'Good morning!'"], [APPROVE])
    assert out["dean_decision"] == "approved" and len(fake.agent_calls) == 1


def test_retry_state_resets_on_every_request():
    state = build_initial_state(Chat(user_id=1, chat_id="c", conversation=[]), HELP)
    assert state["dean_retried"] is False and state["dean_feedback"] == "" and state["dean_retry"] is False
    assert "<dean_feedback>" not in student_context(state)


def test_leak_rule_allows_examples_with_different_values():
    prompt = dean_mod._SYSTEM_PROMPT
    assert "Reject ONLY if the draft" in prompt
    assert "different values or a different scenario" in prompt
    assert "In short exercises (one or two lines)" in prompt
    assert "trivially adapted" not in prompt  # the old rule rejected every short-exercise example


def test_example_agents_never_use_the_problems_own_values():
    from ai.nodes import erroneous_ebl_node, faded_ebl_node
    for mod in (complete_mod, faded_ebl_node, erroneous_ebl_node):
        assert "NEVER use the exact values, strings or names from <original_problem>" in mod._SYSTEM_PROMPT
