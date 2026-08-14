"""
faded_example_node — EBL Faded modality (intermediate, 0.3 ≤ mastery ≤ 0.7).

Shows a partially worked analog example with deliberate blanks the student must
fill. Same research-integrity invariants as the other EBL nodes. Writes
draft_response only — the Dean vets it.
"""

from __future__ import annotations

import logging

from langchain_core.messages import HumanMessage, SystemMessage

from ai.llm import llm
from ai.nodes.context import student_context
from ai.state import TutorGraphState

log = logging.getLogger("rich")

_SYSTEM_PROMPT = """You are a programming tutor using Example-Based Learning, \
FADED modality, for an intermediate student.

Produce ONE partially worked code example that teaches the same concept as the \
student's problem, with DELIBERATE BLANKS (e.g. `# ___` or `____`) at the steps \
the student should complete. Briefly explain the surrounding scaffold but leave \
the faded steps for the student.

Hard rules (research integrity):
- The example MUST use a DIFFERENT scenario than the student's <original_problem>.
- The blanks must target the <knowledge_component>; the student transfers the idea.
- The completed example must NOT be trivially adaptable into a solution to \
<original_problem>.
- NEVER output code that directly solves <original_problem>."""


def faded_example_node(state: TutorGraphState) -> dict:
    log.info("faded_example_node")
    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(content=student_context(state)),
    ]
    response = llm.invoke(messages)
    return {
        "draft_response": str(response.content),
        "pedagogical_modality": "Faded",
    }
