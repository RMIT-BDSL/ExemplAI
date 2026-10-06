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
    response_type: str                # "new_example" | "follow_up" (Dean checks differ)
    trigger: str                      # "get_help" | "new_example" (buttons: always a new example) | "message"

    # ── Internal: example allowance (web/convex/examples.ts) ──────────
    examples_remaining: int           # examples earned but not yet given this round
    example_limit_message: str        # shown when a typed request would exceed it
    delivered_response_type: str      # set by the Dean: what reached the student

    # ── Internal: Dean decision and one retry (reset each request) ────
    dean_retry: bool                  # route the draft back to its agent once
    dean_retried: bool                # the one retry has been used
    dean_feedback: str                # why the first draft was rejected (agent sees it)
    dean_decision: str                # approved | approved_after_retry | rejected | limit
    dean_reason: str                  # check that fired (saved with the reply)
    rejected_drafts: List[dict]       # drafts the Dean turned down: {content, reason, excerpt}

    # ── Internal: input-safety gate (input_guardrail writes these) ────
    guardrail_passed: bool
    guardrail_violation: str

    # ── Internal: ACL management ───────────────────────
    orgId: str
