"""Unit tests for server/bkt.py — classic BKT closed forms (pyBKT-compatible)."""

from bkt import (
    DEFAULT_PARAMS,
    MASTERY_THRESHOLD,
    _load_fitted_params,
    initial_mastery,
    is_mastered,
    p_correct,
    posterior_given_obs,
    transition,
    update_mastery,
    update_mastery_sequence,
)


def test_defaults_match_p_init_spec():
    assert DEFAULT_PARAMS["prior"] == 0.15
    assert DEFAULT_PARAMS["learn"] == 0.25
    assert DEFAULT_PARAMS["guess"] == 0.4
    assert DEFAULT_PARAMS["forget"] == 0.0
    assert initial_mastery() == 0.15
    assert initial_mastery("unknown_kc") == 0.15


def test_p_correct_emission():
    # P(correct) = 0.15*(1-0.1) + 0.85*0.4 = 0.135 + 0.34 = 0.475
    assert abs(p_correct(0.15) - 0.475) < 1e-9


def test_posterior_correct():
    # P(L|✓) = 0.15*0.9 / (0.15*0.9 + 0.85*0.2) = 0.135 / 0.305
    post = posterior_given_obs(0.15, True, guess=0.2, slip=0.1)
    assert abs(post - (0.135 / 0.305)) < 1e-9


def test_posterior_incorrect():
    # P(L|✗) = 0.15*0.1 / (0.15*0.1 + 0.85*0.8) = 0.015 / 0.695
    post = posterior_given_obs(0.15, False, guess=0.2, slip=0.1)
    assert abs(post - (0.015 / 0.695)) < 1e-9


def test_transition_no_forget():
    # P' = post + (1-post)*learn
    assert abs(transition(0.5, learn=0.3, forget=0.0) - 0.65) < 1e-9


def test_transition_with_forget():
    # P' = post*(1-f) + (1-post)*learn = 0.5*0.9 + 0.5*0.3 = 0.6
    assert abs(transition(0.5, learn=0.3, forget=0.1) - 0.6) < 1e-9


def test_update_correct_matches_hand_formula():
    # full step from P-Init with defaults
    post = 0.135 / 0.475
    expected = post + (1 - post) * 0.25
    got = update_mastery(0.15, True)
    assert abs(got - expected) < 1e-9
    assert abs(got - 0.46315789473684216) < 1e-9


def test_update_incorrect_matches_hand_formula():
    post = 0.015 / 0.525
    expected = post + (1 - post) * 0.25
    got = update_mastery(0.15, False)
    assert abs(got - expected) < 1e-9


def test_sequence_two_corrects_increases_mastery():
    p0 = initial_mastery()
    p1 = update_mastery(p0, True)
    p2 = update_mastery(p1, True)
    assert p1 > p0
    assert p2 > p1
    assert update_mastery_sequence(p0, [True, True]) == p2


def test_clamps_to_unit_interval():
    assert update_mastery(1.5, True) <= 1.0
    assert update_mastery(-0.2, False) >= 0.0


def test_param_file_matches_defaults_for_every_kc():
    # data/bktParams.json is hand-set to the defaults for every syllabus topic
    # (COSC3104/5 weeks 1-12, no class in week 7); keep in sync.
    fitted = _load_fitted_params()
    assert set(fitted) == {
        "intro_setup", "variables_expressions", "strings_formatting",
        "branching", "loops", "advanced_loops", "functions", "collections",
        "files", "basic_libraries", "advanced_topics",
    }
    for kc, params in fitted.items():
        assert params == DEFAULT_PARAMS, kc


def test_first_fail_keeps_novice_below_faded_band():
    # learn=0.25: a first failed submit leaves a novice in Complete (< 0.3).
    assert update_mastery(initial_mastery("loops"), False, "loops") < 0.3


def test_mastery_threshold():
    assert MASTERY_THRESHOLD == 0.95
    assert is_mastered(0.95)
    assert not is_mastered(0.9499)


def test_four_straight_passes_reach_mastery():
    # guess=0.4: a pass is weaker evidence, so 3 passes (0.90) fall short.
    p0 = initial_mastery("loops")
    assert not is_mastered(update_mastery_sequence(p0, [True] * 3, "loops"))
    assert is_mastered(update_mastery_sequence(p0, [True] * 4, "loops"))
