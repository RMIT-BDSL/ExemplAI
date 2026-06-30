"""
Shared helper: build the dynamic per-invocation context block.

Static instructions live in each node's SystemMessage. Dynamic state goes here
as an XML-delimited HumanMessage body (agent prompt convention from CLAUDE.md).
"""

from __future__ import annotations

from ai.state import TutorGraphState


def student_context(state: TutorGraphState) -> str:
    """XML-delimited snapshot of the student's current turn for a HumanMessage."""
    return (
        f"<original_problem>\n{state.get('original_problem', '')}\n</original_problem>\n"
        f"<knowledge_component>\n{state.get('current_knowledge_component', '')}\n</knowledge_component>\n"
        f"<student_code>\n{state.get('student_code', '')}\n</student_code>\n"
        f"<error_trace>\n{state.get('error_trace', '')}\n</error_trace>"
    )
