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
    from ai.nodes import complete_ebl_node, erroneous_ebl_node, faded_ebl_node
    assert _spec_literal("COMPLETE_EXAMPLE_SYSTEM") == complete_ebl_node._SYSTEM_PROMPT
    assert _spec_literal("FADED_EXAMPLE_SYSTEM") == faded_ebl_node._SYSTEM_PROMPT
    assert _spec_literal("ERRONEOUS_EXAMPLE_SYSTEM") == erroneous_ebl_node._SYSTEM_PROMPT
    assert _spec_literal("DEAN_SYSTEM") == dean_validation._SYSTEM_PROMPT
    assert _spec_literal("CONTROL_SYSTEM") == control_agent._SYSTEM_PROMPT
    assert _spec_literal("RESPONSE_TYPE_INSTRUCTION") == context.RESPONSE_TYPE_INSTRUCTION


def test_spec_shows_the_codes_shared_context_helpers():
    src = Path(context.__file__).read_text(encoding="utf-8")
    for node in ast.parse(src).body:
        if getattr(node, "name", None) in ("student_context", "conversation", "topic_bug_context"):
            assert ast.get_source_segment(src, node) in SPEC, node.name


def test_spec_agents_use_the_codes_context_layout_and_tag_names():
    for name in ("COMPLETE_EXAMPLE_SYSTEM", "FADED_EXAMPLE_SYSTEM", "ERRONEOUS_EXAMPLE_SYSTEM"):
        prompt = _spec_literal(name)
        assert "<allowed_python>" in prompt, name
        assert "Target Problem" not in prompt, name
    # Context first, conversation last; no trailing "Generate ..." instruction.
    assert SPEC.count("HumanMessage(content=student_context(state") >= 4
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


def test_example_agents_have_the_allowed_features_rule_and_control_does_not():
    from ai.nodes import complete_ebl_node, erroneous_ebl_node, faded_ebl_node
    for mod in (complete_ebl_node, faded_ebl_node, erroneous_ebl_node):
        assert "<allowed_python>" in mod._SYSTEM_PROMPT, mod.__name__
    assert "<allowed_python>" not in control_agent._SYSTEM_PROMPT  # truly generic tutor
    control_context = student_context({"current_knowledge_component": "loops", "experiment_condition": "control"})
    assert "<allowed_python>" not in control_context


def test_dean_exempts_deliberate_faded_blanks():
    assert "deliberate blanks in a Faded example" in dean_validation._SYSTEM_PROMPT


def test_typed_messages_are_pointed_to_the_new_example_button():
    assert "A typed message never gets a new example" in context.RESPONSE_TYPE_INSTRUCTION
    for prompt in _prompts():
        assert "New example button gives one" in prompt and "generate a NEW" not in prompt


def test_week_two_allows_a_close_analog_for_faded_and_the_dean():
    from ai.nodes.context import close_analog_context
    assert "<close_analog>" in close_analog_context({"current_knowledge_component": "variables_expressions"})
    assert close_analog_context({"current_knowledge_component": "branching"}) == ""
    _, faded, _ = _prompts()
    assert "When <close_analog> is given, follow it instead" in faded
    week2 = dean_validation._dean_input({"current_knowledge_component": "variables_expressions", "messages": []})
    assert "<close_analog_allowed>true</close_analog_allowed>" in week2
    assert "<close_analog_allowed>false</close_analog_allowed>" in dean_validation._dean_input({"messages": []})
    assert "When close_analog_allowed is true" in dean_validation._SYSTEM_PROMPT


def test_button_presses_are_spelled_out_for_the_model():
    base = {"current_knowledge_component": "loops", "experiment_condition": "experimental"}
    help_text = student_context({**base, "trigger": "get_help"})
    assert "<student_action>\nThe student pressed Get help" in help_text
    assert "targets the failure in <error_trace>" in help_text
    assert "different scenario" in student_context({**base, "trigger": "new_example"})
    # Control is a plain chat: no button context and no example allowance.
    control = student_context({**base, "experiment_condition": "control", "trigger": "get_help",
                               "examples_remaining": 0})
    assert "<student_action>" not in control and "<examples_remaining>" not in control
    assert "<student_action>" not in student_context({**base, "trigger": "message"})
    assert help_text.endswith("reply to their latest message.")


# ── ported prompt content (review items 5-8 and the team's decisions) ─

def _prompts():
    from ai.nodes import complete_ebl_node, erroneous_ebl_node, faded_ebl_node
    return complete_ebl_node._SYSTEM_PROMPT, faded_ebl_node._SYSTEM_PROMPT, erroneous_ebl_node._SYSTEM_PROMPT


def test_no_agent_asks_the_student_to_explain():
    complete, faded, erroneous = _prompts()
    assert "Do not ask the student to explain anything" in complete
    assert "Do not ask the student to explain anything" in faded
    assert "Do not ask them to explain why it fails" in erroneous
    assert "inline comments on every meaningful line" not in complete


def test_complete_and_faded_use_step_labels_erroneous_does_not():
    complete, faded, erroneous = _prompts()
    assert "Label the steps of the method" in complete and "with step labels" in complete
    assert "Label every step of the method" in faded
    assert "Do not add step labels or other comments that point to the bug" in erroneous


def test_faded_fades_the_gap_step_judges_by_working_and_has_the_stuck_escape():
    _, faded, _ = _prompts()
    # A different task, not the exercise renamed (a quarter were, eval 2026-10-07).
    assert "if a small edit would turn your completed example into the exercise's answer" in faded
    # Fade the step of the gap, sized to it.
    assert "Fade one step: one blank, on the step that practises the gap" in faded
    assert "the key part of a line" in faded and "Keep at least two thirds of the code worked out" in faded
    assert "never the code that does it" in faded  # labels give the goal, not the blank
    # Enough worked steps to learn from; the label is the only hint (eval, 2026-10-07).
    assert "3 to 5 labelled steps" in faded and "# ???" not in faded
    # Expression mistakes (brackets, / for //) stay on one line to be practised (eval 2026-10-09).
    assert "keep that expression whole on one line and blank it" in faded
    assert "only by whether the completed example would then work" in faded
    assert "tried the same blank twice without success" in faded


def test_erroneous_asks_to_find_one_topic_bug_without_giving_it_away():
    _, _, erroneous = _prompts()
    assert "EXACTLY ONE bug" in erroneous and "<topic_bugs>" in erroneous
    assert "This code has a bug. Can you find it?" in erroneous and "runnable" in erroneous
    # The failing input and outputs gave the bug away (eval, 2026-10-07).
    assert "Do not say which input fails" in erroneous
    assert "This code fails on" not in erroneous
    assert "After two unsuccessful tries: tell them which line" in erroneous


def test_all_example_agents_aim_at_the_failure():
    for prompt in _prompts():
        assert "<error_trace>" in prompt
        assert "without guessing the hidden inputs" in prompt


def test_erroneous_context_lists_the_topics_bug_types_only_for_erroneous():
    import ai.nodes.erroneous_ebl_node as err
    from ai.nodes.context import topic_bug_context
    from ai.syllabus import TOPIC_BUGS
    assert list(TOPIC_BUGS) == [t for t, _, _ in SYLLABUS]
    block = topic_bug_context({"current_knowledge_component": "branching"})
    assert block.startswith("<topic_bugs>") and "> instead of >=" in block
    assert "<topic_bugs>" not in student_context({"current_knowledge_component": "branching"})
    assert "topic_bug_context(state)" in Path(err.__file__).read_text()


def test_dean_limit_allows_an_earlier_example_shown_again():
    # The Dean called the completed code of a Faded example "a new worked example" and the
    # student got the example-limit message: a third of correct completions (eval, 2026-10-07).
    assert "showing an earlier example's code again" in dean_validation._SYSTEM_PROMPT


def test_dean_allows_the_stuck_escapes():
    prompt = dean_validation._SYSTEM_PROMPT
    assert "student_messages_since_example is 2 or more" in prompt  # tries counted in code
    assert "compare with current_example" in prompt
    # A short typed answer counts: correct answers were blocked 43/68 times (eval 2026-10-08).
    assert "An answer can be just the missing" in prompt
    assert "tried the same blank twice without success" in prompt
    assert "after two unsuccessful tries the tutor may name" in prompt
    assert "exactly one intentional, non-trivial logic bug for the student to fix" in prompt

