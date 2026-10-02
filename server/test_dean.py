"""Unit tests for response_type labelling and the Dean's inputs/outcomes (no real LLM)."""

import os

os.environ.setdefault("OPENAI_API_KEY", "test")  # ai.llm builds an OpenAI client at import

from langchain_core.messages import AIMessage, HumanMessage

import ai.nodes.dean_validation as dean_mod
import ai.nodes.faded_ebl_node as faded_mod
from ai.nodes.context import (
    FOLLOW_UP,
    NEW_EXAMPLE,
    response_type_from_history,
    split_response_type,
)
from ai.nodes.dean_validation import DeanValidationResult, _FALLBACK, _dean_input

FIRST_TURN = {"messages": [HumanMessage(content="help")]}
LATER_TURN = {
    "messages": [
        HumanMessage(content="help"),
        AIMessage(content="Here is an example with blanks ..."),
        HumanMessage(content="is the blank `total += x`?"),
    ]
}


def test_first_reply_is_always_new_example_and_tag_is_stripped():
    draft, rtype = split_response_type("[FOLLOW_UP]\nHere is an example", FIRST_TURN)
    assert rtype == NEW_EXAMPLE
    assert draft == "Here is an example"


def test_tags_after_first_reply():
    assert split_response_type("[FOLLOW_UP]\nYes!", LATER_TURN) == ("Yes!", FOLLOW_UP)
    assert split_response_type("[NEW_EXAMPLE]\nA new one", LATER_TURN) == ("A new one", NEW_EXAMPLE)
    assert split_response_type("**[follow_up]**\nYes!", LATER_TURN) == ("Yes!", FOLLOW_UP)


def test_missing_tag_falls_back_to_history():
    assert split_response_type("Yes!", LATER_TURN) == ("Yes!", FOLLOW_UP)
    assert split_response_type("An example", FIRST_TURN) == ("An example", NEW_EXAMPLE)


def test_control_label_comes_from_history():
    assert response_type_from_history(FIRST_TURN) == NEW_EXAMPLE
    assert response_type_from_history(LATER_TURN) == FOLLOW_UP
    # dict messages (as sent by the web client) count too
    assert response_type_from_history({"messages": [{"role": "assistant", "content": "hi"}]}) == FOLLOW_UP


def test_dean_input_carries_label_history_and_code():
    state = {
        **LATER_TURN,
        "experiment_condition": "experimental",
        "pedagogical_modality": "Faded",
        "response_type": FOLLOW_UP,
        "original_problem": "sum a list",
        "student_code": "def f(l): pass",
        "draft_response": "Close — check the loop variable.",
    }
    text = _dean_input(state)
    assert "<response_type>follow_up</response_type>" in text
    assert "<pedagogical_modality>Faded</pedagogical_modality>" in text
    assert "is the blank `total += x`?" in text  # history included
    assert "def f(l): pass" in text
    assert "Close — check the loop variable." in text


class _FakeLlm:
    """Stands in for the chat model: records prompts, returns canned output."""

    def __init__(self, reply=None, verdict=None):
        self.reply, self.verdict, self.calls = reply, verdict, []

    def invoke(self, messages):
        self.calls.append(messages)
        return AIMessage(content=self.reply)

    def with_structured_output(self, schema):
        assert schema is DeanValidationResult
        fake = self

        class _Structured:
            def invoke(self, messages):
                fake.calls.append(messages)
                return fake.verdict

        return _Structured()


def test_dean_approves_and_forwards_draft(monkeypatch):
    fake = _FakeLlm(verdict=DeanValidationResult(status="approved"))
    monkeypatch.setattr(dean_mod, "llm", fake)
    out = dean_mod.dean_validation_node({**LATER_TURN, "draft_response": "Nice work!", "response_type": FOLLOW_UP})
    assert out == {"messages": [{"role": "ai", "content": "Nice work!"}], "delivered_response_type": FOLLOW_UP}
    system_prompt = fake.calls[0][0].content
    assert "MODALITY_DRIFT" in system_prompt and "control" in system_prompt


def test_dean_rejection_substitutes_fallback(monkeypatch):
    verdict = DeanValidationResult(status="rejected", reason="MODALITY_DRIFT", violation_excerpt="total += x")
    monkeypatch.setattr(dean_mod, "llm", _FakeLlm(verdict=verdict))
    out = dean_mod.dean_validation_node({**LATER_TURN, "draft_response": "The answer is total += x"})
    assert out == {"messages": [{"role": "ai", "content": _FALLBACK}], "delivered_response_type": "fallback"}


def test_faded_agent_labels_and_strips_its_reply(monkeypatch):
    fake = _FakeLlm(reply="[FOLLOW_UP]\nAlmost: what should start at 0?")
    monkeypatch.setattr(faded_mod, "llm", fake)
    out = faded_mod.faded_example_node(LATER_TURN)
    assert out == {
        "draft_response": "Almost: what should start at 0?",
        "pedagogical_modality": "Faded",
        "response_type": FOLLOW_UP,
    }
    assert "[NEW_EXAMPLE]" in fake.calls[0][0].content  # instruction appended to system prompt
