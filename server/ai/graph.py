"""
ExemplAI tutor graph.

Topology (mirrors the target pipeline in CLAUDE.md):

    START → input_guardrail → [route_after_guardrail]
        ├─ blocked → guardrail_blocked ───────────────────────────────→ END
        └─ safe    → experiment_entry → [experiment_router]
                ├─ control      → control_agent_node ─────────────────┐
                └─ experimental → orchestrator → [orchestrator_router] │
                                      ├─ complete_example_node  ───────┤
                                      ├─ faded_example_node     ───────┤
                                      └─ erroneous_example_node ───────┤
                                                                       ↓
                                                  dean_validation_node → END

input_guardrail screens input first; experiment_router and orchestrator_router
are pure Python (no LLM). Every agent draft routes through dean_validation_node —
the research-integrity gate. guardrail_blocked emits a fixed safe refusal and so
intentionally skips the Dean.
"""

from ai.nodes import (
    complete_example_node,
    control_agent_node,
    dean_validation_node,
    erroneous_example_node,
    faded_example_node,
    guardrail_blocked,
    input_guardrail,
    route_after_guardrail,
)
from ai.graph_router import experiment_router, orchestrator_router
from ai.state import TutorGraphState
from langgraph.graph import START, END, StateGraph


def orchestrator(state: TutorGraphState):
    """Pure pass-through branch point for the experimental group; the EBL node
    is chosen by orchestrator_router on the outgoing conditional edge."""
    return {}


def experiment_entry(state: TutorGraphState):
    """Pure pass-through branch point after the guardrail; the A/B condition is
    chosen by experiment_router on the outgoing conditional edge."""
    return {}


graph = StateGraph(TutorGraphState)

graph.add_node("input_guardrail", input_guardrail)
graph.add_node("guardrail_blocked", guardrail_blocked)
graph.add_node("experiment_entry", experiment_entry)
graph.add_node("orchestrator", orchestrator)
graph.add_node("control_agent_node", control_agent_node)
graph.add_node("complete_example_node", complete_example_node)
graph.add_node("faded_example_node", faded_example_node)
graph.add_node("erroneous_example_node", erroneous_example_node)
graph.add_node("dean_validation_node", dean_validation_node)

# Input-safety gate runs first.
graph.add_edge(START, "input_guardrail")
graph.add_conditional_edges(
    "input_guardrail",
    route_after_guardrail,
    {
        "blocked": "guardrail_blocked",
        "safe": "experiment_entry",
    },
)
graph.add_edge("guardrail_blocked", END)

# A/B split (sticky condition read from state).
graph.add_conditional_edges(
    "experiment_entry",
    experiment_router,
    {
        "control": "control_agent_node",
        "experimental": "orchestrator",
    },
)

# Experimental: BKT mastery → EBL modality.
graph.add_conditional_edges(
    "orchestrator",
    orchestrator_router,
    [
        "complete_example_node",
        "faded_example_node",
        "erroneous_example_node",
    ],
)

# Every drafted response is vetted by the Dean before reaching the student.
graph.add_edge("control_agent_node", "dean_validation_node")
graph.add_edge("complete_example_node", "dean_validation_node")
graph.add_edge("faded_example_node", "dean_validation_node")
graph.add_edge("erroneous_example_node", "dean_validation_node")
graph.add_edge("dean_validation_node", END)

graph = graph.compile()
