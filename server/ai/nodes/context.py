"""
Shared helpers for the tutor nodes.

Static instructions live in each node's SystemMessage. Dynamic state goes here
as an XML-delimited HumanMessage body (agent prompt convention from CLAUDE.md).

Also owns ``response_type``: every agent draft is labelled ``new_example`` (a
fresh Complete/Faded/Erroneous example) or ``follow_up`` (a reply about an
example already given). The Dean checks the two differently, so a follow-up
isn't rejected for lacking blanks or a bug.
"""

from __future__ import annotations

import logging
import re

from ai.state import TutorGraphState
from ai.syllabus import allowed_python

log = logging.getLogger("rich")

NEW_EXAMPLE = "new_example"
FOLLOW_UP = "follow_up"

# Appended to each EBL agent's system prompt.
RESPONSE_TYPE_INSTRUCTION = """

<response_type>
Start your reply with exactly one tag on its own first line:
[NEW_EXAMPLE] if this reply presents a new example: your first reply in the \
conversation, or the student asked for a different example.
[FOLLOW_UP] if this reply responds to the student about an example you already \
gave: answering a question, giving feedback on their attempt, or a narrower hint.
The tag is removed before the student sees your reply.
If <examples_remaining> is 0, do not present a new example, even if the student \
asks for one: help them with the examples already given instead.
</response_type>"""

# Chat-button triggers: always a new example (they spend the example allowance).
_BUTTON_TRIGGERS = ("get_help", "new_example")

# Tells the model which button was pressed, so its reply matches the
# new_example label the server gives every button reply (see split_response_type).
_STUDENT_ACTION = {
    ("get_help", "experimental"): "The student pressed Get help after a failed Submit: "
    "present a new example that targets the failure in <error_trace>.",
    ("new_example", "experimental"): "The student pressed New example: present a new "
    "example in a different scenario from the examples earlier in this conversation.",
    ("get_help", "control"): "The student pressed Get help after a failed Submit: "
    "help them with the failure in <error_trace>.",
    ("new_example", "control"): "The student pressed New example: give a fresh "
    "explanation from a different angle than earlier in this conversation.",
}

_TAG_RE = re.compile(r"^\s*\**\[(NEW_EXAMPLE|FOLLOW_UP)\]\**[ \t]*\n?", re.IGNORECASE)

# Recent turns sent to the agents (Convex already caps what it returns).
_AGENT_HISTORY_TURNS = 20

# Recent turns shown to the Dean; each turn is truncated to keep the check cheap.
_HISTORY_TURNS = 10
_HISTORY_CHARS = 1500


def student_context(state: TutorGraphState) -> str:
    """XML-delimited snapshot of the student's current turn for a HumanMessage.

    Goes BEFORE the conversation (see conversation()), so the model replies to
    the student's latest message rather than to an instruction placed last.
    """
    allowed = allowed_python(state.get("current_knowledge_component"))
    condition = "control" if state.get("experiment_condition") == "control" else "experimental"
    action = _STUDENT_ACTION.get((state.get("trigger", ""), condition))
    return (
        f"<original_problem>\n{state.get('original_problem', '')}\n</original_problem>\n"
        f"<knowledge_component>\n{state.get('current_knowledge_component', '')}\n</knowledge_component>\n"
        + (f"<allowed_python>\n{allowed}\n</allowed_python>\n" if allowed else "")
        + f"<student_code>\n{state.get('student_code', '')}\n</student_code>\n"
        f"<error_trace>\n{state.get('error_trace', '')}\n</error_trace>\n"
        + (
            f"<examples_remaining>{state['examples_remaining']}</examples_remaining>\n"
            if state.get("examples_remaining") is not None
            else ""
        )
        + (f"<student_action>\n{action}\n</student_action>\n" if action else "")
        + "The conversation with the student follows; reply to their latest message."
    )


def conversation(state: TutorGraphState) -> list:
    """The lesson conversation for an agent's LLM call.

    Oldest first, ending with the student's latest message, so it goes AFTER
    the context message and the model replies to what the student just said.
    """
    return list(state.get("messages", []))[-_AGENT_HISTORY_TURNS:]


def _role(msg) -> str:
    role = msg.get("role", "") if isinstance(msg, dict) else getattr(msg, "type", "")
    return "tutor" if role in ("ai", "assistant") else "student"


def _content(msg) -> str:
    content = msg.get("content", "") if isinstance(msg, dict) else getattr(msg, "content", "")
    return str(content or "")


def has_prior_tutor_reply(state: TutorGraphState) -> bool:
    """True if the conversation already contains a tutor reply (before this draft)."""
    return any(_role(m) == "tutor" for m in state.get("messages", []))


def split_response_type(raw: str, state: TutorGraphState) -> tuple[str, str]:
    """Strip the agent's [NEW_EXAMPLE]/[FOLLOW_UP] tag; return (draft, response_type).

    The first tutor reply in a conversation, and any reply to the Get help or
    New example buttons, is always a new example, whatever the tag says. A
    missing tag falls back to the same history rule.
    """
    match = _TAG_RE.match(raw)
    draft = raw[match.end():] if match else raw
    if state.get("trigger") in _BUTTON_TRIGGERS or not has_prior_tutor_reply(state):
        return draft, NEW_EXAMPLE
    if match:
        return draft, NEW_EXAMPLE if match.group(1).upper() == "NEW_EXAMPLE" else FOLLOW_UP
    log.warning("response_type tag missing from agent draft; defaulting to follow_up")
    return draft, FOLLOW_UP


def response_type_from_history(state: TutorGraphState) -> str:
    """Control agent: no tag, label from history only (first reply vs later)."""
    if state.get("trigger") in _BUTTON_TRIGGERS:
        return NEW_EXAMPLE
    return FOLLOW_UP if has_prior_tutor_reply(state) else NEW_EXAMPLE


def recent_history(state: TutorGraphState) -> str:
    """Last few turns as plain text for the Dean (oldest first)."""
    turns = state.get("messages", [])[-_HISTORY_TURNS:]
    if not turns:
        return "(no earlier turns)"
    lines = []
    for m in turns:
        text = _content(m)
        if len(text) > _HISTORY_CHARS:
            text = text[:_HISTORY_CHARS] + " …[truncated]"
        lines.append(f"[{_role(m)}]\n{text}")
    return "\n\n".join(lines)
