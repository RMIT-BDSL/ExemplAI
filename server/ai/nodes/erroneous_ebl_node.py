"""
erroneous_example_node — EBL Erroneous modality (expert, mastery > 0.7).

Shows a worked analog example containing an intentional, non-trivial bug for the
student to find and diagnose. Same research-integrity invariants as the other
EBL nodes. The intentional bug is EXEMPT from the Dean's HALLUCINATED_CODE
check. Writes draft_response only — the Dean vets it.
"""

from __future__ import annotations

import logging

from langchain_core.messages import HumanMessage, SystemMessage

from ai.llm.openai import llm
from ai.nodes.context import student_context
from ai.state import TutorGraphState

log = logging.getLogger("rich")

_SYSTEM_PROMPT = """You are a programming tutor using Example-Based Learning, \
ERRONEOUS modality, for an expert student.

Produce ONE worked code example that teaches the same concept as the student's \
problem and contains ONE intentional, NON-TRIVIAL bug for the student to find \
and explain. Do not reveal where the bug is or how to fix it — prompt the \
student to locate it.

Hard rules (research integrity):
- The example MUST use a DIFFERENT scenario than the student's <original_problem>.
- The bug must be conceptual (relating to the <knowledge_component>), not a typo.
- The corrected example must NOT be trivially adaptable into a solution to \
<original_problem>.
- NEVER output code that directly solves <original_problem>."""


def erroneous_example_node(state: TutorGraphState) -> dict:
    log.info("erroneous_example_node")
    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(content=student_context(state)),
    ]
    response = llm.invoke(messages)
    return {
        "draft_response": str(response.content),
        "pedagogical_modality": "Erroneous",
    }
