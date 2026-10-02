"""Get help flow: failed-Submit summary, the chat lock, and the get_help trigger."""

import asyncio
import os

os.environ.setdefault("OPENAI_API_KEY", "test")  # ai.llm builds an OpenAI client at import

import pytest
from fastapi import HTTPException
from langchain_core.messages import AIMessage, HumanMessage

import ai.nodes.complete_ebl_node as complete_mod
import services.chat as chat_service
from ai.nodes.context import NEW_EXAMPLE, response_type_from_history, split_response_type
from model.chat import Chat
from services import summarize_failures
from services.chat import ChatLocked, ConvexChatContext, build_initial_state, check_chat_lock

GET_HELP_TEXT = "Please provide me an example to help me with this"


def _chat(**kw):
    return Chat(**{"user_id": 1, "chat_id": "chat1", "conversation": [], **kw})


# ── summarize_failures ────────────────────────────────────────────────

def test_summary_details_visible_failures_and_only_counts_hidden_ones():
    results = [
        {"passed": True, "hidden": False, "input": "1", "expected": "1", "stdout": "1"},
        {"passed": False, "hidden": False, "input": "3", "expected": "6", "stdout": "5\n", "stderr": ""},
        {"passed": False, "hidden": True, "input": "SECRET_INPUT", "expected": "SECRET_OUT", "stdout": "x"},
        {"passed": False, "hidden": True, "input": "SECRET2", "expected": "SECRET3", "stdout": "y"},
    ]
    text = summarize_failures(results)
    assert "Input: 3\nExpected: 6\nGot: 5" in text
    assert "2 hidden test(s) failed (details withheld)." in text
    assert "SECRET" not in text
    assert "Input: 1" not in text  # passing tests are left out


def test_summary_reports_a_compile_error_once():
    err = {"passed": False, "hidden": False, "status_id": 6, "stderr": "SyntaxError: invalid syntax"}
    text = summarize_failures([err, dict(err), {**err, "hidden": True}])
    assert text.count("SyntaxError") == 1
    assert "1 hidden test(s) failed" in text


def test_summary_is_capped():
    big = {"passed": False, "hidden": False, "input": "x" * 5000, "expected": "y", "stdout": "z"}
    assert len(summarize_failures([big])) == 2000


# ── the chat lock ─────────────────────────────────────────────────────

HELP_TURN = [{"sender": "user", "content": GET_HELP_TEXT}]
AFTER_REPLY = HELP_TURN + [{"sender": "assistant", "content": "an example"}, {"sender": "user", "content": "why?"}]


def test_get_help_needs_a_failed_submit_and_works_once():
    with pytest.raises(ChatLocked, match="failed Submit"):
        check_chat_lock(_chat(trigger="get_help"), HELP_TURN, failed_submits=0)
    check_chat_lock(_chat(trigger="get_help"), HELP_TURN, failed_submits=1)  # unlocked
    with pytest.raises(ChatLocked, match="already started"):
        check_chat_lock(_chat(trigger="get_help"), AFTER_REPLY, failed_submits=2)


def test_typed_messages_need_get_help_first():
    with pytest.raises(ChatLocked, match="after Get help"):
        check_chat_lock(_chat(), [{"sender": "user", "content": "hi"}], failed_submits=3)
    check_chat_lock(_chat(), AFTER_REPLY, failed_submits=1)  # unlocked


def test_lock_is_skipped_when_convex_predates_it():
    check_chat_lock(_chat(), [{"sender": "user", "content": "hi"}], failed_submits=None)
    check_chat_lock(_chat(trigger="get_help"), None, failed_submits=None)


def test_locked_request_is_a_403_not_a_502(monkeypatch):
    async def fake_context(client, chat):
        return ConvexChatContext([{"sender": "user", "content": "hi"}], 0)

    monkeypatch.setattr(chat_service, "_convex_client", lambda token: object())
    monkeypatch.setattr(chat_service, "_load_convex_context", fake_context)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(chat_service.run_chat(graph=None, chat=_chat(), auth_user_id="u", auth_token="t"))
    assert exc.value.status_code == 403
    assert "after Get help" in exc.value.detail


# ── the get_help trigger ──────────────────────────────────────────────

def test_get_help_is_always_a_new_example():
    state = {"trigger": "get_help", "messages": [HumanMessage(content="hi"), AIMessage(content="earlier")]}
    assert split_response_type("[FOLLOW_UP]\nHere is one", state) == ("Here is one", NEW_EXAMPLE)
    assert response_type_from_history(state) == NEW_EXAMPLE


def test_get_help_carries_trigger_and_error_to_the_agent(monkeypatch):
    calls = []

    class FakeLlm:
        def invoke(self, messages):
            calls.append(messages)
            return AIMessage(content="[NEW_EXAMPLE]\nAn example")

    monkeypatch.setattr(complete_mod, "llm", FakeLlm())
    chat = _chat(trigger="get_help", error_trace="Input: 3\nExpected: 6\nGot: 5", bkt_prob_mastery=0.15)
    state = build_initial_state(chat, HELP_TURN)
    assert state["trigger"] == "get_help"

    out = complete_mod.complete_example_node({**state, "messages": [HumanMessage(content=GET_HELP_TEXT)]})
    assert out["response_type"] == NEW_EXAMPLE
    context_message = calls[0][1].content
    assert "<error_trace>\nInput: 3\nExpected: 6\nGot: 5\n</error_trace>" in context_message
    assert calls[0][-1].content == GET_HELP_TEXT
