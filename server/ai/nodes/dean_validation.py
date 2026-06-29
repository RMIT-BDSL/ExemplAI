"""
dean_validation_node — the research-integrity gate.

Every drafted response passes through the Dean before reaching the student. The
Dean is the ONLY node that appends to ``messages``: it approves the draft (and
forwards it) or rejects it (and substitutes a safe fallback). Uses structured
output for a deterministic approve/reject decision.
"""

from __future__ import annotations

import logging
from typing import Literal, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from ai.llm.openai import llm
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


_SYSTEM_PROMPT = """You are the Dean, a strict reviewer of tutor responses for an \
educational coding platform. Decide whether the drafted response may reach the \
student.

Reject (status="rejected") on any of these violations:
- INAPPROPRIATE_CONTENT: unsafe, offensive, or off-topic content.
- HALLUCINATED_CODE: code that is broken or fabricated in a way the modality does \
NOT intend. EXCEPTION: an intentional bug in an "Erroneous" modality draft is \
expected and must NOT be rejected for this.

The following checks apply ONLY when <experiment_condition> is "experimental" \
(EBL). They do NOT apply to the "control" condition:
- DIRECT_ANSWER_LEAK: the draft hands the student a solution to <original_problem>, \
or an example trivially adaptable (rename/minor restructure) into one.
- MODALITY_VIOLATION: the draft does not match its <pedagogical_modality> \
(Complete = full worked example; Faded = deliberate blanks; Erroneous = an \
intentional non-trivial bug).

Otherwise approve (status="approved"). On rejection, set reason to the violation \
name and violation_excerpt to the offending snippet."""


def dean_validation_node(state: TutorGraphState) -> dict:
    log.info("dean_validation_node")
    draft = state.get("draft_response", "")

    human = (
        f"<experiment_condition>{state.get('experiment_condition', '')}</experiment_condition>\n"
        f"<pedagogical_modality>{state.get('pedagogical_modality', '')}</pedagogical_modality>\n"
        f"<original_problem>\n{state.get('original_problem', '')}\n</original_problem>\n"
        f"<draft_response>\n{draft}\n</draft_response>"
    )

    dean = llm.with_structured_output(DeanValidationResult)
    result: DeanValidationResult = dean.invoke(
        [SystemMessage(content=_SYSTEM_PROMPT), HumanMessage(content=human)]
    )

    if result.status == "approved":
        log.info("dean_validation_node → approved")
        return {"messages": [{"role": "ai", "content": draft}]}

    log.warning(f"dean_validation_node → rejected ({result.reason})")
    return {"messages": [{"role": "ai", "content": _FALLBACK}]}
