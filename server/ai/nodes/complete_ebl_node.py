"""
complete_example_node — EBL Complete modality (novice, mastery < 0.3).

Shows a fully worked analog example. Research integrity: the example MUST use a
different scenario than original_problem and must not be trivially adaptable to
solve it (see CLAUDE.md). Writes draft_response only — the Dean vets it.
"""

from __future__ import annotations

import logging

from langchain_core.messages import HumanMessage, SystemMessage

from ai.llm import llm
from ai.nodes.context import student_context
from ai.state import TutorGraphState

log = logging.getLogger("rich")

_SYSTEM_PROMPT = """You are a programming tutor using Example-Based Learning, \
COMPLETE modality, for a novice student.

Produce ONE fully worked code example that teaches the same concept as the \
student's problem, then briefly explain each step.

Hard rules (research integrity):
- The example MUST use a DIFFERENT scenario than the student's <original_problem>. \
Pick a different domain, different variable names, different data.
- The student must transfer the idea themselves. Your example must NOT be \
trivially adaptable (rename a variable, minor restructure) into a solution to \
<original_problem>.
- NEVER output code that directly solves <original_problem>.
- Teach the <knowledge_component>. Keep it concise and correct."""


def complete_example_node(state: TutorGraphState) -> dict:
    log.info("complete_example_node")
    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(content=student_context(state)),
    ]
    response = llm.invoke(messages)
    return {
        "draft_response": str(response.content),
        "pedagogical_modality": "Complete",
    }
