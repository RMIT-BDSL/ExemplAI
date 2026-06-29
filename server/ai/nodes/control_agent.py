"""
control_agent_node — RCT control group (standard LLM tutor, no EBL scaffolding).

This is the baseline a generic LLM tutor would give. It still routes through the
Dean, but only for safety (INAPPROPRIATE_CONTENT / HALLUCINATED_CODE) — the
EBL-specific checks (DIRECT_ANSWER_LEAK, MODALITY_VIOLATION) do not apply to the
control condition, or it would no longer be a true baseline. Writes
draft_response only — the Dean vets it.
"""

from __future__ import annotations

import logging

from langchain_core.messages import HumanMessage, SystemMessage

from ai.llm.openai import llm
from ai.nodes.context import student_context
from ai.state import TutorGraphState

log = logging.getLogger("rich")

_SYSTEM_PROMPT = """You are a helpful programming tutor. Help the student with \
their problem the way a standard AI assistant would: explain concepts, point out \
issues in their code, and guide them toward a working solution. Be clear and \
concise."""


def control_agent_node(state: TutorGraphState) -> dict:
    log.info("control_agent_node")
    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(content=student_context(state)),
    ]
    response = llm.invoke(messages)
    return {"draft_response": str(response.content)}
