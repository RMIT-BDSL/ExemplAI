"""Unit tests for server/bkt.py — classic BKT closed forms (pyBKT-compatible)."""

from bkt import (
    DEFAULT_PARAMS,
    initial_mastery,
    p_correct,
    posterior_given_obs,
    transition,
    update_mastery,
    update_mastery_sequence,
)


def test_defaults_match_p_init_spec():
    assert DEFAULT_PARAMS["prior"] == 0.15
    assert DEFAULT_PARAMS["forget"] == 0.0
    assert initial_mastery() == 0.15
    assert initial_mastery("unknown_kc") == 0.15


def test_p_correct_emission():
    # P(correct) = 0.15*(1-0.1) + 0.85*0.2 = 0.135 + 0.17 = 0.305
    assert abs(p_correct(0.15) - 0.305) < 1e-9


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
    post = 0.135 / 0.305
    expected = post + (1 - post) * 0.3
    got = update_mastery(0.15, True)
    assert abs(got - expected) < 1e-9
    assert abs(got - 0.6098360655737705) < 1e-9


def test_update_incorrect_matches_hand_formula():
    post = 0.015 / 0.695
    expected = post + (1 - post) * 0.3
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
