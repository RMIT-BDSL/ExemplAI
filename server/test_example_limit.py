"""New example limit (option B, cap 3): server-side enforcement and what gets saved."""

import asyncio
import os

os.environ.setdefault("OPENAI_API_KEY", "test")  # ai.llm builds an OpenAI client at import

import pytest
from langchain_core.messages import AIMessage, HumanMessage

import ai.nodes.dean_validation as dean_mod
import services.chat as chat_service
from ai.nodes.context import NEW_EXAMPLE, split_response_type, student_context
from ai.nodes.dean_validation import DeanValidationResult, _dean_input
from model.chat import Chat
from services.chat import ChatLocked, ConvexChatContext, check_chat_lock, example_limit_message, with_allowance

HISTORY = [HumanMessage(content="help"), AIMessage(content="an example"), HumanMessage(content="another one please")]


def _allowance(used, earned, cap=3):
    return {"cap": cap, "used": used, "earned": earned, "remaining": max(0, earned - used),
            "exhausted": used >= cap, "helpStarted": used > 0}


def test_new_example_button_rules():
    chat = Chat(user_id=1, chat_id="c", conversation=[], trigger="new_example")
    with pytest.raises(ChatLocked, match="Get help first"):
        check_chat_lock(chat, _allowance(used=0, earned=2))
    with pytest.raises(ChatLocked, match="Submit another attempt"):
        check_chat_lock(chat, _allowance(used=1, earned=1))  # earned one, used one
    check_chat_lock(chat, _allowance(used=1, earned=2))  # a second failed Submit earned it
    with pytest.raises(ChatLocked, match="try another topic"):
        check_chat_lock(chat, _allowance(used=3, earned=3))


def test_limit_messages_and_graph_input():
    assert "another topic" in example_limit_message(_allowance(used=3, earned=3))
    assert "Submit another attempt" in example_limit_message(_allowance(used=1, earned=1))
    state = with_allowance({"messages": []}, _allowance(used=1, earned=1))
    assert state["examples_remaining"] == 0
    assert with_allowance({"messages": []}, None) == {"messages": []}  # older Convex: no limit


def test_agents_are_told_how_many_examples_remain():
    assert "<examples_remaining>0</examples_remaining>" in student_context({"examples_remaining": 0})
    assert "examples_remaining" not in student_context({})  # older Convex: not limited


def test_new_example_button_is_always_a_new_example():
    state = {"trigger": "new_example", "messages": HISTORY}
    assert split_response_type("[FOLLOW_UP]\nAnother one", state) == ("Another one", NEW_EXAMPLE)


class _Dean:
    def __init__(self, verdict):
        self.verdict, self.calls = verdict, []

    def with_structured_output(self, schema):
        dean = self

        class _S:
            def invoke(self, messages):
                dean.calls.append(messages)
                return dean.verdict

        return _S()


def _typed_state(**kw):
    return {"messages": HISTORY, "trigger": "message", "experiment_condition": "experimental",
            "pedagogical_modality": "Faded", "examples_remaining": 0,
            "example_limit_message": "LIMIT MESSAGE", "draft_response": "Here's a new problem...", **kw}


def test_typed_request_over_the_limit_is_answered_without_the_llm(monkeypatch):
    dean = _Dean(DeanValidationResult(status="approved"))
    monkeypatch.setattr(dean_mod, "llm", dean)
    out = dean_mod.dean_validation_node(_typed_state(response_type=NEW_EXAMPLE))
    assert out["messages"] == [{"role": "ai", "content": "LIMIT MESSAGE"}]
    assert out["delivered_response_type"] == "fallback" and out["dean_decision"] == "limit"
    assert dean.calls == []


def test_mislabelled_new_example_over_the_limit_is_caught_by_the_dean(monkeypatch):
    dean = _Dean(DeanValidationResult(status="rejected", reason="EXAMPLE_LIMIT"))
    monkeypatch.setattr(dean_mod, "llm", dean)
    out = dean_mod.dean_validation_node(_typed_state(response_type="follow_up"))
    assert out["messages"][0]["content"] == "LIMIT MESSAGE"
    assert out["delivered_response_type"] == "fallback"
    system_prompt, dean_input = dean.calls[0][0].content, dean.calls[0][1].content
    assert "EXAMPLE_LIMIT" in system_prompt
    assert "<examples_remaining>0</examples_remaining>" in dean_input


def test_dean_input_without_allowance_says_not_limited():
    assert "<examples_remaining>not limited</examples_remaining>" in _dean_input({"messages": []})


def test_delivered_type_is_saved_with_the_reply(monkeypatch):
    saved = {}

    class FakeGraph:
        async def ainvoke(self, state, config):
            assert state["examples_remaining"] == 1
            return {"messages": [AIMessage(content="example 2")], "delivered_response_type": NEW_EXAMPLE,
                    "dean_decision": "approved_after_retry", "dean_reason": "DIRECT_ANSWER_LEAK",
                    "guardrail_passed": True, "experiment_condition": "experimental", "bkt_prob_mastery": 0.5}

    async def fake_context(client, chat):
        return ConvexChatContext([{"sender": "user", "content": "x"}], _allowance(used=1, earned=2))

    async def fake_save(client, chat_id, text, chosen_model, response_type=None, **dean):
        saved.update(text=text, response_type=response_type, **dean)

    async def fake_condition(user_id, chat):
        return None

    monkeypatch.setattr(chat_service, "_convex_client", lambda token: object())
    monkeypatch.setattr(chat_service, "_load_convex_context", fake_context)
    monkeypatch.setattr(chat_service, "_save_assistant_message", fake_save)
    monkeypatch.setattr(chat_service, "_evaluate_posthog_condition", fake_condition)
    chat = Chat(user_id=1, chat_id="c", conversation=[], trigger="new_example")
    asyncio.run(chat_service.run_chat(FakeGraph(), chat, auth_user_id="u", auth_token="t"))
    assert saved == {"text": "example 2", "response_type": NEW_EXAMPLE,
                     "dean_decision": "approved_after_retry", "dean_reason": "DIRECT_ANSWER_LEAK"}


# ── control group: plain chat, Dean checks the answer leak only ───────

def test_control_is_never_locked_or_limited():
    control = Chat(user_id=1, chat_id="c", conversation=[], experiment_condition="control")
    check_chat_lock(control, _allowance(used=0, earned=0))  # typed before any failed Submit: fine


def test_control_first_reply_is_not_blocked_by_the_example_limit(monkeypatch):
    dean = _Dean(DeanValidationResult(status="approved"))
    monkeypatch.setattr(dean_mod, "llm", dean)
    state = _typed_state(experiment_condition="control", pedagogical_modality="Control",
                         response_type=NEW_EXAMPLE, draft_response="Here's how loops work...")
    out = dean_mod.dean_validation_node(state)
    assert out["messages"][0]["content"] == "Here's how loops work..."
    assert len(dean.calls) == 1  # went to the Dean, not short-circuited


def test_dean_checks_control_for_leak_safety_and_broken_code_but_not_examples():
    prompt = dean_mod._SYSTEM_PROMPT
    control_rules = prompt[prompt.index("<control>"):prompt.index("</control>")]
    assert "only checks 1-3" in control_rules and "Never apply the example checks (4-6)" in control_rules
    always = prompt[prompt.index("<always_check>"):prompt.index("</always_check>")]
    for check in ("1. DIRECT_ANSWER_LEAK", "2. INAPPROPRIATE_CONTENT", "3. HALLUCINATED_CODE"):
        assert check in always, check


def test_control_chat_gets_no_allowance(monkeypatch):
    seen = {}

    class FakeGraph:
        async def ainvoke(self, state, config):
            seen.update(state)
            return {"messages": [AIMessage(content="ok")], "delivered_response_type": "follow_up",
                    "guardrail_passed": True, "experiment_condition": "control"}

    async def fake_context(client, chat):
        return ConvexChatContext([{"sender": "user", "content": "how do loops work?"}], _allowance(used=0, earned=0))

    async def fake_save(*args, **kwargs):
        return None

    async def fake_condition(user_id, chat):
        return None

    monkeypatch.setattr(chat_service, "_convex_client", lambda token: object())
    monkeypatch.setattr(chat_service, "_load_convex_context", fake_context)
    monkeypatch.setattr(chat_service, "_save_assistant_message", fake_save)
    monkeypatch.setattr(chat_service, "_evaluate_posthog_condition", fake_condition)
    chat = Chat(user_id=1, chat_id="c", conversation=[], experiment_condition="control")
    asyncio.run(chat_service.run_chat(FakeGraph(), chat, auth_user_id="u", auth_token="t"))
    assert "examples_remaining" not in seen  # not locked (no 403) and no allowance in the graph

