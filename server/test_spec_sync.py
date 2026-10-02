"""Keep LangGraph_BKT_Architecture_Spec.md in step with the code, and check the
syllabus feature lists and the shared agent context."""

import ast
import json
import os
import re
from pathlib import Path

os.environ.setdefault("OPENAI_API_KEY", "test")  # ai.llm builds an OpenAI client at import

from ai.nodes import context, control_agent, dean_validation
from ai.nodes.context import student_context
from ai.syllabus import SYLLABUS, allowed_python

REPO = Path(__file__).resolve().parent.parent
SPEC = (REPO / "LangGraph_BKT_Architecture_Spec.md").read_text(encoding="utf-8")


def _spec_literal(name: str) -> str:
    match = re.search(name + r' = ("""(?:.|\n)*?""")', SPEC)
    assert match, f"{name} missing from the spec"
    return ast.literal_eval(match.group(1))


# ── spec ⇄ code ───────────────────────────────────────────────────────

def test_spec_prompts_match_the_code():
    assert _spec_literal("DEAN_SYSTEM") == dean_validation._SYSTEM_PROMPT
    assert _spec_literal("CONTROL_SYSTEM") == control_agent._SYSTEM_PROMPT
    assert _spec_literal("RESPONSE_TYPE_INSTRUCTION") == context.RESPONSE_TYPE_INSTRUCTION


def test_spec_shows_the_codes_shared_context_helpers():
    src = Path(context.__file__).read_text(encoding="utf-8")
    for node in ast.parse(src).body:
        if getattr(node, "name", None) in ("student_context", "conversation"):
            assert ast.get_source_segment(src, node) in SPEC, node.name


def test_spec_agents_use_the_codes_context_layout_and_tag_names():
    for name in ("COMPLETE_EXAMPLE_SYSTEM", "FADED_EXAMPLE_SYSTEM", "ERRONEOUS_EXAMPLE_SYSTEM"):
        prompt = _spec_literal(name)
        assert "<allowed_python>" in prompt, name
        assert "Target Problem" not in prompt, name
    # Context first, conversation last; no trailing "Generate ..." instruction.
    assert SPEC.count("HumanMessage(content=student_context(state)),") >= 3
    assert SPEC.count("*conversation(state),") >= 3
    for stale in ("<target_problem>", "<test_result>", "human_msg"):
        assert stale not in SPEC, stale


# ── syllabus ──────────────────────────────────────────────────────────

def test_syllabus_topics_match_bkt_parameters_and_seed_lessons():
    topics = [t for t, _, _ in SYLLABUS]
    params = json.loads((REPO / "data" / "bktParams.json").read_text())["kc_parameters"]
    assert topics == list(params)  # same topics, same (teaching) order
    seed = (REPO / "web" / "convex" / "seed.ts").read_text()
    assert set(re.findall(r'knowledge_component: "([^"]+)"', seed)) <= set(topics)


def test_allowed_features_are_cumulative():
    week2 = allowed_python("variables_expressions")
    assert "print()" in week2 and "% **" in week2  # weeks 1 and 2
    assert "for loops" not in week2 and "lists" not in week2  # later topics
    loops = allowed_python("loops")
    assert "if / elif / else" in loops and "for loops" in loops
    assert "lists and list methods" not in loops
    assert "def name(parameters)" in week2  # lessons are functions from week 1
    assert allowed_python("unknown_topic") == "" and allowed_python(None) == ""


# ── shared context and the Dean ───────────────────────────────────────

def test_context_carries_allowed_features_and_asks_for_a_reply_to_the_latest_message():
    text = student_context({"current_knowledge_component": "branching", "original_problem": "p"})
    assert "<allowed_python>\n- a function definition" in text
    assert "if / elif / else" in text and "for loops" not in text
    assert text.endswith("reply to their latest message.")
    for tag in ("original_problem", "knowledge_component", "allowed_python", "student_code", "error_trace"):
        assert text.count(f"<{tag}>") == 1, tag  # each block exactly once
    assert "<allowed_python>" not in student_context({"current_knowledge_component": "unknown"})


def test_every_agent_prompt_has_the_allowed_features_rule():
    from ai.nodes import complete_ebl_node, erroneous_ebl_node, faded_ebl_node
    for mod in (complete_ebl_node, faded_ebl_node, erroneous_ebl_node, control_agent):
        assert "<allowed_python>" in mod._SYSTEM_PROMPT, mod.__name__


def test_dean_exempts_deliberate_faded_blanks():
    assert "deliberate blanks in a Faded example" in dean_validation._SYSTEM_PROMPT


def test_button_presses_are_spelled_out_for_the_model():
    base = {"current_knowledge_component": "loops", "experiment_condition": "experimental"}
    help_text = student_context({**base, "trigger": "get_help"})
    assert "<student_action>\nThe student pressed Get help" in help_text
    assert "targets the failure in <error_trace>" in help_text
    assert "different scenario" in student_context({**base, "trigger": "new_example"})
    control = student_context({**base, "experiment_condition": "control", "trigger": "new_example"})
    assert "fresh explanation" in control and "present a new example" not in control
    assert "<student_action>" not in student_context({**base, "trigger": "message"})
    assert help_text.endswith("reply to their latest message.")

