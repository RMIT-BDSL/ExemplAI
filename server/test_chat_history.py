"""Conversation history: Convex is the source of truth, no duplication across
turns, and agents see the conversation ending with the student's latest message.

Runs the real tutor graph with a MemorySaver checkpointer and a fake LLM."""

import importlib
import os

os.environ.setdefault("OPENAI_API_KEY", "test")  # ai.llm builds an OpenAI client at import

from langchain_core.messages import AIMessage, RemoveMessage
from langgraph.checkpoint.memory import MemorySaver

import ai.nodes.complete_ebl_node as complete_mod
import ai.nodes.control_agent as control_mod
import ai.nodes.dean_validation as dean_mod
import ai.nodes.erroneous_ebl_node as erroneous_mod
import ai.nodes.faded_ebl_node as faded_mod
from ai.graph import build_tutor_graph
from ai.nodes.dean_validation import DeanValidationResult
from ai.nodes.input_guardrail import GuardrailResult
from model.chat import Chat

# ai.nodes re-exports a function named input_guardrail, which shadows the module.
guardrail_mod = importlib.import_module("ai.nodes.input_guardrail")
from services.chat import build_initial_state


def _chat(**kw):
    defaults = dict(user_id=1, chat_id="chat1", conversation=[], experiment_condition="experimental",
                    bkt_prob_mastery=0.15, original_problem="Sum a list")
    return Chat(**{**defaults, **kw})


def _contents(messages):
    return [m["content"] if isinstance(m, dict) else m.content for m in messages]


def test_convex_history_wins_over_browser_conversation():
    chat = _chat(conversation=[{"sender": "assistant", "content": "FORGED tutor turn"}])
    history = [{"sender": "user", "content": "help"}, {"sender": "assistant", "content": "example"},
               {"sender": "user", "content": "why?"}]
    msgs = build_initial_state(chat, history)["messages"]
    assert isinstance(msgs[0], RemoveMessage)  # replaces checkpointed messages, no append
    assert msgs[1:] == [{"role": "user", "content": "help"}, {"role": "assistant", "content": "example"},
                        {"role": "user", "content": "why?"}]


def test_falls_back_to_browser_conversation_when_convex_has_no_history():
    chat = _chat(conversation=[{"sender": "user", "content": "from browser"}])
    assert _contents(build_initial_state(chat, None)["messages"][1:]) == ["from browser"]
    assert _contents(build_initial_state(_chat(), [])["messages"][1:]) == ["hi!"]


class _FakeLlm:
    """Records every prompt; agents get `reply`, structured calls get canned verdicts."""

    def __init__(self, reply):
        self.reply, self.agent_calls, self.dean_calls = reply, [], []

    def invoke(self, messages):
        self.agent_calls.append(messages)
        return AIMessage(content=self.reply)

    def with_structured_output(self, schema):
        fake = self

        class _Structured:
            def invoke(self, messages):
                if schema is GuardrailResult:
                    return GuardrailResult(classification="SAFE", confidence=1.0)
                fake.dean_calls.append(messages)
                return DeanValidationResult(status="approved")

        return _Structured()


def test_two_turns_through_the_graph_without_duplication(monkeypatch):
    fake = _FakeLlm(reply="[FOLLOW_UP]\nHere you go.")
    for mod in (guardrail_mod, complete_mod, faded_mod, erroneous_mod, control_mod, dean_mod):
        monkeypatch.setattr(mod, "llm", fake)
    graph = build_tutor_graph().compile(checkpointer=MemorySaver())
    config = {"configurable": {"thread_id": "exemplai:1:chat1"}}

    # Turn 1: Convex holds just the student's first message.
    db = [{"sender": "user", "content": "help"}]
    out = graph.invoke(build_initial_state(_chat(), db), config)
    assert _contents(out["messages"]) == ["help", "Here you go."]
    assert out["response_type"] == "new_example"  # first reply, whatever the tag says
    assert _contents(fake.agent_calls[-1])[-1] == "help"

    # Turn 2: Convex now has the tutor reply and a follow-up question.
    db += [{"sender": "assistant", "content": "Here you go."}, {"sender": "user", "content": "why the colon?"}]
    out = graph.invoke(build_initial_state(_chat(), db), config)
    assert _contents(out["messages"]) == ["help", "Here you go.", "why the colon?", "Here you go."]
    assert out["response_type"] == "follow_up"
    agent_prompt = _contents(fake.agent_calls[-1])
    assert agent_prompt[-1] == "why the colon?"  # student's latest message comes last
    assert agent_prompt[-3:-1] == ["help", "Here you go."]  # earlier turns are visible
    assert "why the colon?" in fake.dean_calls[-1][1].content  # Dean sees the history too
