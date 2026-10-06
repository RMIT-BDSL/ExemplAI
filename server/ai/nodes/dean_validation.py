"""
dean_validation_node — the research-integrity gate.

Every drafted response passes through the Dean before reaching the student. The
Dean is the ONLY node that appends to ``messages``: it approves the draft (and
forwards it) or rejects it (and substitutes a safe fallback). Uses structured
output for a deterministic approve/reject decision.

Checks depend on the condition and the draft's ``response_type``:
- always (both conditions): DIRECT_ANSWER_LEAK, INAPPROPRIATE_CONTENT,
  HALLUCINATED_CODE — the leak judged against the recent conversation, so an
  answer pieced together over several turns is caught;
- control (plain chat): those three only — no example-type or limit checks;
- experimental + new_example: MODALITY_VIOLATION (the example matches its type);
- experimental + follow_up: MODALITY_DRIFT (the reply keeps to its type's
  follow-up rules) instead, so follow-ups aren't rejected for lacking blanks
  or a bug;
- experimental, no examples remaining: EXAMPLE_LIMIT (a typed request can't
  get a new example past the allowance, even if the draft is mislabelled).
A typed request whose draft is labelled new_example with none remaining is
answered with the limit message without calling the LLM. A first rejection
sends the draft back to the same agent once, with the reason in
<dean_feedback> (route_after_dean); a second rejection sends the fallback.
Sets ``delivered_response_type``, ``dean_decision`` and ``dean_reason``, and
adds each draft it turns down to ``rejected_drafts`` (all saved with the reply
in Convex, for research; the student never sees them).
"""

from __future__ import annotations

import logging
from typing import Literal, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from ai.llm import llm
from ai.nodes.context import NEW_EXAMPLE, recent_history

FALLBACK = "fallback"  # delivered_response_type when the draft is replaced

# What happened at the Dean, saved with the reply (dean_decision).
APPROVED, APPROVED_AFTER_RETRY, REJECTED, LIMIT = "approved", "approved_after_retry", "rejected", "limit"
from ai.state import TutorGraphState

log = logging.getLogger("rich")

# Cap on a saved rejected draft (characters).
_DRAFT_CHARS = 8000


def _with_rejected(state: TutorGraphState, draft: str, reason: str, excerpt: Optional[str] = None) -> list[dict]:
    """The request's rejected drafts so far, plus this one."""
    entry = {"content": draft[:_DRAFT_CHARS], "reason": reason}
    if excerpt:
        entry["excerpt"] = excerpt
    return [*(state.get("rejected_drafts") or []), entry]

_FALLBACK = (
    "Let me reconsider how to help with this. Could you tell me what part of the "
    "problem you're stuck on?"
)


class DeanValidationResult(BaseModel):
    status: Literal["approved", "rejected"]
    reason: Optional[str] = None
    violation_excerpt: Optional[str] = None


_SYSTEM_PROMPT = """You are the Dean, an academic integrity validator for a \
university programming tutor. Decide whether the drafted reply may reach the \
student. You do not write tutoring content.

<inputs>
- experiment_condition: "experimental" (example-based tutor) or "control" \
(standard tutor).
- pedagogical_modality: Complete | Faded | Erroneous | Control.
- response_type: "new_example" (a fresh example) or "follow_up" (a reply about \
an example or answer already given).
- examples_remaining: new examples the student may still receive in this \
lesson ("not limited" if unknown).
- conversation_history: recent turns in this lesson, oldest first.
- original_problem, student_code, draft_response.
</inputs>

<always_check>
Apply to every draft, in both conditions:
1. DIRECT_ANSWER_LEAK: the draft hands the student the answer to \
<original_problem>. Reject ONLY if the draft:
   - contains the solution itself: code for the same task that produces the \
outputs <original_problem> asks for (for example its exact strings or numbers); or
   - tells the student exactly what to write in their own code (the corrected \
line or a fully corrected version of <student_code>); or
   - supplies the last missing piece of a solution assembled over earlier turns \
(judge against the whole conversation).
   Explicitly ALLOWED, do not reject: an example of the same concept that uses \
different values or a different scenario, even if its structure matches the \
solution; explaining syntax or concepts; saying what kind of error the student \
has or roughly where it is; a hint. In short exercises (one or two lines) a \
parallel example will look like the solution; that is expected. Approve it \
unless it uses the problem's own values.
2. INAPPROPRIATE_CONTENT: unsafe, offensive, or off-topic content.
3. HALLUCINATED_CODE: code that is broken or fabricated unintentionally. \
Exceptions: the intentional bug in an Erroneous example (including when the \
reply discusses it), the deliberate blanks in a Faded example (placeholder \
lines such as `____` or `# ???: ...` make that code incomplete on purpose), \
and the student's own code quoted back to them.
</always_check>

<experimental_new_example>
Only when experiment_condition is "experimental" and response_type is \
"new_example":
4. MODALITY_VIOLATION: the example does not match <pedagogical_modality>: \
Complete = a full worked parallel example; Faded = a parallel example with \
deliberate blanks for the student to fill; Erroneous = a parallel example with \
exactly one intentional, non-trivial logic bug for the student to fix.
</experimental_new_example>

<experimental_follow_up>
Only when experiment_condition is "experimental" and response_type is \
"follow_up". Do NOT require blanks or a bug here. Check instead:
5. MODALITY_DRIFT: the reply breaks the follow-up rules of its modality:
   - Faded: fills in a blank, or reveals the completed code, before the \
student has correctly completed it themselves. Exception: after the student has \
tried the same blank twice without success, the tutor may show how to work it \
out, including its answer.
   - Erroneous: reveals where the bug is or how to fix it before the student \
has fixed it. Exception: after two unsuccessful tries the tutor may name the \
line with the bug, and after a third it may show the fix.
   - Complete: leaves the parallel example and starts working on \
<original_problem> itself.
Answering the student's question, re-explaining, giving feedback on their \
attempt, or giving a narrower hint is allowed.
</experimental_follow_up>

<example_limit>
Only when experiment_condition is "experimental" and examples_remaining is 0:
6. EXAMPLE_LIMIT: the draft presents a new worked example (a new parallel \
problem with its own code), whatever its response_type says. Discussing, \
re-explaining or hinting about examples already given is allowed.
</example_limit>

<control>
The control condition is a plain chat tutor that gives no examples: apply \
only checks 1-3. Never apply the example checks (4-6).
</control>

Otherwise approve (status="approved"). On rejection, set reason to the check \
name and violation_excerpt to the offending snippet."""


def _dean_input(state: TutorGraphState) -> str:
    """XML-delimited HumanMessage body for the Dean."""
    return (
        f"<experiment_condition>{state.get('experiment_condition', '')}</experiment_condition>\n"
        f"<pedagogical_modality>{state.get('pedagogical_modality', '')}</pedagogical_modality>\n"
        f"<response_type>{state.get('response_type') or NEW_EXAMPLE}</response_type>\n"
        f"<examples_remaining>{_examples_remaining_text(state)}</examples_remaining>\n"
        f"<conversation_history>\n{recent_history(state)}\n</conversation_history>\n"
        f"<original_problem>\n{state.get('original_problem', '')}\n</original_problem>\n"
        f"<student_code>\n{state.get('student_code', '')}\n</student_code>\n"
        f"<draft_response>\n{state.get('draft_response', '')}\n</draft_response>"
    )


def _examples_remaining_text(state: TutorGraphState) -> str:
    remaining = state.get("examples_remaining")
    return "not limited" if remaining is None else str(remaining)


def _over_example_limit(state: TutorGraphState) -> bool:
    """Experimental: a typed request answered with a new example when none remain."""
    return (
        state.get("experiment_condition") != "control"
        and state.get("trigger", "message") == "message"
        and state.get("response_type") == NEW_EXAMPLE
        and state.get("examples_remaining") == 0
    )


def dean_validation_node(state: TutorGraphState) -> dict:
    log.info("dean_validation_node")
    draft = state.get("draft_response", "")
    limit_message = state.get("example_limit_message") or _FALLBACK

    if _over_example_limit(state):
        log.info("dean_validation_node → example limit reached")
        return {
            "messages": [{"role": "ai", "content": limit_message}],
            "delivered_response_type": FALLBACK,
            "dean_decision": LIMIT,
            "dean_reason": "EXAMPLE_LIMIT",
            "dean_retry": False,
            "rejected_drafts": _with_rejected(state, draft, "EXAMPLE_LIMIT"),
        }

    dean = llm.with_structured_output(DeanValidationResult)
    result: DeanValidationResult = dean.invoke(
        [SystemMessage(content=_SYSTEM_PROMPT), HumanMessage(content=_dean_input(state))]
    )

    retried = bool(state.get("dean_retried"))
    if result.status == "approved":
        log.info(f"dean_validation_node → approved{' after retry' if retried else ''}")
        return {
            "messages": [{"role": "ai", "content": draft}],
            "delivered_response_type": state.get("response_type") or NEW_EXAMPLE,
            "dean_decision": APPROVED_AFTER_RETRY if retried else APPROVED,
            "dean_reason": state.get("dean_reason", "") if retried else "",
            "dean_retry": False,
        }

    reason = result.reason or "UNSPECIFIED"
    log.warning(f"dean_validation_node → rejected ({reason})")
    rejected = _with_rejected(state, draft, reason, result.violation_excerpt)
    if not retried and reason != "EXAMPLE_LIMIT":
        # One retry: send the draft back to the same agent with the reason.
        feedback = reason + (f": {result.violation_excerpt}" if result.violation_excerpt else "")
        return {"dean_retry": True, "dean_retried": True, "dean_feedback": feedback, "dean_reason": reason,
                "rejected_drafts": rejected}

    fallback = limit_message if reason == "EXAMPLE_LIMIT" else _FALLBACK
    return {
        "messages": [{"role": "ai", "content": fallback}],
        "delivered_response_type": FALLBACK,
        "dean_decision": LIMIT if reason == "EXAMPLE_LIMIT" else REJECTED,
        "dean_reason": reason,
        "dean_retry": False,
        "rejected_drafts": rejected,
    }


# Agent node for each modality (where a rejected draft is sent for its retry).
_AGENT_FOR_MODALITY = {
    "Complete": "complete_example_node",
    "Faded": "faded_example_node",
    "Erroneous": "erroneous_example_node",
    "Control": "control_agent_node",
}


def route_after_dean(state: TutorGraphState) -> str:
    """After the Dean: back to the same agent for its one retry, else finish."""
    if state.get("dean_retry"):
        return _AGENT_FOR_MODALITY.get(state.get("pedagogical_modality", ""), "end")
    return "end"
