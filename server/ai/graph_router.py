"""
Pure-Python edge routers for the tutor graph (NO LLM calls).

- experiment_router  — A/B split on experiment_condition (sticky, read from state).
- orchestrator_router — BKT mastery → EBL modality, governed by the
  Expertise Reversal Effect.

The orchestrator thresholds (< 0.3, 0.3-0.7, > 0.7) are grounded in research
theory. Do NOT change them without an explicit research team decision (see
CLAUDE.md Research Integrity Constraints).
"""

from __future__ import annotations

import logging

from ai.state import TutorGraphState

log = logging.getLogger("rich")


def experiment_router(state: TutorGraphState) -> str:
    """Route on the sticky A/B assignment. Returns 'control' or 'experimental'."""
    condition = state.get("experiment_condition", "experimental")
    log.info(f"experiment_router → {condition}")
    if condition == "control":
        return "control"
    return "experimental"


def orchestrator_router(state: TutorGraphState) -> str:
    """Map BKT mastery to an EBL node name (Expertise Reversal Effect)."""
    mastery = state.get("bkt_prob_mastery", 0.0)

    if mastery < 0.3:
        node = "complete_example_node"
    elif mastery <= 0.7:
        node = "faded_example_node"
    else:
        node = "erroneous_example_node"

    log.info(f"orchestrator_router → {node} (mastery={mastery})")
    return node
