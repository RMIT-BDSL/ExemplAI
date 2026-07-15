"""
TutorGraphState — LangGraph state for the ExemplAI tutor graph.

Carries every piece of data passed between nodes in the graph. Mirrors the
spec in CLAUDE.md. The one addition beyond the documented spec is
``draft_response``: agent nodes write their draft here and never touch
``messages`` directly, so the Dean Agent stays the only node that appends a
student-facing message — the research-integrity gate.
"""

from __future__ import annotations

from typing import Annotated, List

from langgraph.graph import add_messages
from typing_extensions import TypedDict


class TutorGraphState(TypedDict):
    # ── Conversation (vetted, student-facing) ─────────────────────────
    messages: Annotated[List[dict], add_messages]

    # ── Problem context (static, from dataset / request) ──────────────
    original_problem: str             # problem description the student is solving
    unit_test_assertions: str         # deterministic assert code
    current_knowledge_component: str  # e.g., "loops"

    # ── BKT routing input ─────────────────────────────────────────────
    bkt_prob_mastery: float           # 0.0–1.0, drives orchestrator_router
    pedagogical_modality: str         # "Complete" | "Faded" | "Erroneous"

    # ── Submission context ────────────────────────────────────────────
    student_code: str                 # submitted code
    error_trace: str                  # unit test failure output

    # ── Experiment assignment ─────────────────────────────────────────
    experiment_condition: str         # "experimental" | "control"

    # ── Internal: unvetted agent draft (Dean reads this) ──────────────
    draft_response: str

    # ── Internal: input-safety gate (input_guardrail writes these) ────
    guardrail_passed: bool
    guardrail_violation: str

    # ── Internal: ACL management ───────────────────────
    orgId: str
