"""
dean_validation_node — the research-integrity gate.

Every drafted response passes through the Dean before reaching the student. The
Dean is the ONLY node that appends to ``messages``: it approves the draft (and
forwards it) or rejects it (and substitutes a safe fallback). Uses structured
output for a deterministic approve/reject decision.

Checks depend on the condition and the draft's ``response_type``:
- always (both conditions): DIRECT_ANSWER_LEAK, INAPPROPRIATE_CONTENT,
  HALLUCINATED_CODE — judged against the recent conversation, so an answer
  pieced together over several turns is caught;
- experimental + new_example: MODALITY_VIOLATION (the example matches its type);
- experimental + follow_up: MODALITY_DRIFT (the reply keeps to its type's
  follow-up rules) instead, so follow-ups aren't rejected for lacking blanks
  or a bug.
"""

from __future__ import annotations

import logging
from typing import Literal, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from ai.llm import llm
from ai.nodes.context import NEW_EXAMPLE, recent_history
from ai.state import TutorGraphState

log = logging.getLogger("rich")

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
- conversation_history: recent turns in this lesson, oldest first.
- original_problem, student_code, draft_response.
</inputs>

<always_check>
Apply to every draft, in both conditions:
1. DIRECT_ANSWER_LEAK: the draft hands the student a solution to \
<original_problem>. Judge it against the whole conversation: reject a draft that \
supplies the last missing piece of a solution assembled over earlier turns.
   - experimental: reject code that solves <original_problem>, or an example \
that could be trivially adapted (renaming, minor restructuring) into a solution.
   - control: reject a complete working solution to <original_problem> or a \
fully corrected version of <student_code>. Explaining an error, pointing to \
where it is, a hint, or a short syntax snippet is allowed.
2. INAPPROPRIATE_CONTENT: unsafe, offensive, or off-topic content.
3. HALLUCINATED_CODE: code that is broken or fabricated unintentionally. \
Exceptions: the intentional bug in an Erroneous example (including when the \
reply discusses it), and the student's own code quoted back to them.
</always_check>

<experimental_new_example>
Only when experiment_condition is "experimental" and response_type is \
"new_example":
4. MODALITY_VIOLATION: the example does not match <pedagogical_modality>: \
Complete = a full worked parallel example; Faded = a parallel example with \
deliberate blanks for the student to fill; Erroneous = a parallel example with \
one intentional, non-trivial logic bug for the student to find.
</experimental_new_example>

<experimental_follow_up>
Only when experiment_condition is "experimental" and response_type is \
"follow_up". Do NOT require blanks or a bug here. Check instead:
5. MODALITY_DRIFT: the reply breaks the follow-up rules of its modality:
   - Faded: fills in a blank, or reveals the completed code, before the \
student has correctly completed it themselves.
   - Erroneous: reveals where the bug is or how to fix it before the student \
has correctly diagnosed it.
   - Complete: leaves the parallel example and starts working on \
<original_problem> itself.
Answering the student's question, re-explaining, giving feedback on their \
attempt, or giving a narrower hint is allowed.
</experimental_follow_up>

<control>
In the control condition, apply only checks 1-3. There are no modality checks.
</control>

Otherwise approve (status="approved"). On rejection, set reason to the check \
name and violation_excerpt to the offending snippet."""


def _dean_input(state: TutorGraphState) -> str:
    """XML-delimited HumanMessage body for the Dean."""
    return (
        f"<experiment_condition>{state.get('experiment_condition', '')}</experiment_condition>\n"
        f"<pedagogical_modality>{state.get('pedagogical_modality', '')}</pedagogical_modality>\n"
        f"<response_type>{state.get('response_type') or NEW_EXAMPLE}</response_type>\n"
        f"<conversation_history>\n{recent_history(state)}\n</conversation_history>\n"
        f"<original_problem>\n{state.get('original_problem', '')}\n</original_problem>\n"
        f"<student_code>\n{state.get('student_code', '')}\n</student_code>\n"
        f"<draft_response>\n{state.get('draft_response', '')}\n</draft_response>"
    )


def dean_validation_node(state: TutorGraphState) -> dict:
    log.info("dean_validation_node")
    draft = state.get("draft_response", "")

    dean = llm.with_structured_output(DeanValidationResult)
    result: DeanValidationResult = dean.invoke(
        [SystemMessage(content=_SYSTEM_PROMPT), HumanMessage(content=_dean_input(state))]
    )

    if result.status == "approved":
        log.info("dean_validation_node → approved")
        return {"messages": [{"role": "ai", "content": draft}]}

    log.warning(f"dean_validation_node → rejected ({result.reason})")
    return {"messages": [{"role": "ai", "content": _FALLBACK}]}
