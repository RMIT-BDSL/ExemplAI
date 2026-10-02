"""
control_agent_node — RCT control group (standard LLM tutor, no EBL scaffolding).

This is the baseline a generic LLM tutor would give, with the same guardrail as
the experimental group (ResearchMethodology.md §4.4: never hand over a complete
solution). It routes through the Dean for DIRECT_ANSWER_LEAK,
INAPPROPRIATE_CONTENT and HALLUCINATED_CODE; the EBL modality checks do not
apply to the control condition. Writes draft_response only — the Dean vets it.
"""

from __future__ import annotations

import logging

from langchain_core.messages import HumanMessage, SystemMessage

from ai.llm import llm
from ai.nodes.context import conversation, response_type_from_history, student_context
from ai.state import TutorGraphState

log = logging.getLogger("rich")

_SYSTEM_PROMPT = """You are a helpful programming tutor. Help the student with \
their problem the way a standard AI assistant would: explain concepts, point out \
issues in their code, and guide them toward a working solution. Be clear and \
concise.

Do not write out a complete solution to the student's problem, or a fully \
corrected version of their code. Explaining an error, pointing to where it is, \
giving a hint, or showing a short snippet of syntax is fine.

Use only the Python features listed in <allowed_python>; never use a feature \
from a later topic."""


def control_agent_node(state: TutorGraphState) -> dict:
    log.info("control_agent_node")
    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(content=student_context(state)),
        *conversation(state),
    ]
    response = llm.invoke(messages)
    return {
        "draft_response": str(response.content),
        "pedagogical_modality": "Control",
        "response_type": response_type_from_history(state),
    }
