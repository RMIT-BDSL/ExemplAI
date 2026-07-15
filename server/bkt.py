"""Bayesian Knowledge Tracing — online updates (standard 4/5-param model).

Mirrors the closed-form updates used by pyBKT's simple model
(`predict_onestep` + Roster): Bayesian emission update, then a learn/forget
transition. Offline fitting still belongs in `data/fit_bkt_baseline.py`
(pyBKT); this module only applies already-known parameters.

Defaults follow LangGraph_BKT_Architecture_Spec.md (P-Init = 0.15).
Optional per-KC overrides load from `data/bktParams.json` when present
(output of fit_bkt_baseline: `{ "kc_parameters": { kc: {prior, learn, ...} } }`).
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Optional, Sequence

log = logging.getLogger("rich")

# P-Init baseline + typical BKT transit / emission defaults until CSEDM-fitted
# params are available. forget=0 matches classic Corbett & Anderson BKT
# (and pyBKT's default non-forgets model).
DEFAULT_PARAMS = {
    "prior": 0.15,
    "learn": 0.3,
    "guess": 0.2,
    "slip": 0.1,
    "forget": 0.0,
}

_PARAM_ALIASES = {
    "prior": ("prior", "p_init", "pL0"),
    "learn": ("learn", "learns", "transit", "p_transit"),
    "guess": ("guess", "guesses", "p_guess"),
    "slip": ("slip", "slips", "p_slip"),
    "forget": ("forget", "forgets", "p_forget"),
}


def _params_path() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "bktParams.json"


def _as_float(value: object, default: float) -> float:
    if value is None:
        return default
    if isinstance(value, (list, tuple)) and value:
        value = value[0]
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _clamp_prob(x: float) -> float:
    """Keep probabilities in (0, 1) for stable Bayes updates; allow exact 0/1 only at edges."""
    if x != x:  # NaN
        return 0.0
    return min(1.0, max(0.0, float(x)))


def _clamp_param(name: str, value: float) -> float:
    """Clamp BKT params to ranges pyBKT / theory expect."""
    v = _clamp_prob(value)
    # learn/guess/slip/forget of exactly 0 or 1 can zero-out denominators; keep tiny epsilon interior
    if name in ("learn", "guess", "slip", "forget") and v in (0.0, 1.0):
        return v  # 0 forget is intentional; exact 0/1 for others is rare but allowed
    return v


@lru_cache(maxsize=1)
def _load_fitted_params() -> dict[str, dict[str, float]]:
    path = _params_path()
    if not path.is_file():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        block: dict = {}
        for key in ("kc_parameters", "params", "skills"):
            if isinstance(raw.get(key), dict):
                block = raw[key]
                break
        if not block:
            block = {
                k: v
                for k, v in raw.items()
                if isinstance(v, dict) and any(a in v for a in ("prior", "learn", "learns"))
            }
        out: dict[str, dict[str, float]] = {}
        for kc, p in block.items():
            if not isinstance(p, dict):
                continue
            out[str(kc)] = _normalize_param_dict(p)
        return out
    except Exception as e:
        log.warning("bkt — failed to load %s: %s", path, e)
        return {}


def _normalize_param_dict(p: dict) -> dict[str, float]:
    """Map fitted / alias keys onto our canonical param names."""
    result = dict(DEFAULT_PARAMS)
    for canon, aliases in _PARAM_ALIASES.items():
        for alias in aliases:
            if alias in p:
                result[canon] = _as_float(p[alias], result[canon])
                break
    return {k: _clamp_param(k, v) for k, v in result.items()}


def params_for_kc(knowledge_component: Optional[str] = None) -> dict[str, float]:
    """Return prior/learn/guess/slip/forget for a KC (fitted if present)."""
    fitted = _load_fitted_params()
    if knowledge_component and knowledge_component in fitted:
        return dict(fitted[knowledge_component])
    return dict(DEFAULT_PARAMS)


def initial_mastery(knowledge_component: Optional[str] = None) -> float:
    """Cold-start P(L₀) before any observations (P-Init / fitted prior)."""
    return params_for_kc(knowledge_component)["prior"]


def p_correct(prob_mastery: float, knowledge_component: Optional[str] = None) -> float:
    """P(correct next) = P(L)(1−slip) + (1−P(L))guess  (pyBKT emission prediction)."""
    p = params_for_kc(knowledge_component)
    p_l = _clamp_prob(prob_mastery)
    return p_l * (1.0 - p["slip"]) + (1.0 - p_l) * p["guess"]


def posterior_given_obs(
    prob_mastery: float,
    correct: bool,
    *,
    guess: float,
    slip: float,
) -> float:
    """P(L | observation) — Bayes update on the latent mastery state.

    Matches the emission step in pyBKT / classic BKT:
      correct:   P(L|✓) ∝ P(L)(1−slip)
      incorrect: P(L|✗) ∝ P(L)·slip
    """
    p_l = _clamp_prob(prob_mastery)
    if correct:
        numer = p_l * (1.0 - slip)
        denom = numer + (1.0 - p_l) * guess
    else:
        numer = p_l * slip
        denom = numer + (1.0 - p_l) * (1.0 - guess)
    if denom <= 0.0:
        return p_l
    return numer / denom


def transition(prob_mastery_post: float, *, learn: float, forget: float) -> float:
    """Apply learn/forget transition after an observation (pyBKT As step).

    P(L_{t+1}) = P(L|obs)·(1−forget) + (1−P(L|obs))·learn
    With forget=0 this is the classic P' = P + (1−P)·learn.
    """
    p = _clamp_prob(prob_mastery_post)
    return p * (1.0 - forget) + (1.0 - p) * learn


def update_mastery(
    prob_mastery: float,
    correct: bool,
    knowledge_component: Optional[str] = None,
) -> float:
    """One BKT step: emission posterior, then learn/forget transition.

    Equivalent to pyBKT Roster.update_state for a single binary observation
    on a skill with fixed parameters (no multigs / multilearn).
    """
    p = params_for_kc(knowledge_component)
    post = posterior_given_obs(
        prob_mastery,
        correct,
        guess=p["guess"],
        slip=p["slip"],
    )
    next_p = transition(post, learn=p["learn"], forget=p["forget"])
    return _clamp_prob(next_p)


def update_mastery_sequence(
    prob_mastery: float,
    outcomes: Sequence[bool],
    knowledge_component: Optional[str] = None,
) -> float:
    """Apply a sequence of correct/incorrect observations in order."""
    p_l = _clamp_prob(prob_mastery)
    for correct in outcomes:
        p_l = update_mastery(p_l, bool(correct), knowledge_component)
    return p_l
