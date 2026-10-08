"""Run an evaluation phase: speed | quality | dean. See eval/__init__.py."""

from __future__ import annotations

import argparse
import json
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

import httpx
from langchain_core.callbacks import BaseCallbackHandler
from langgraph.checkpoint.memory import MemorySaver

import ai.llm as llm_mod
from ai.graph import build_tutor_graph
from ai.nodes.dean_validation import dean_validation_node
from config import settings
from model.chat import Chat
from services.chat import build_initial_state, with_allowance

from eval import checks
from eval.cases import (BANDS, GET_HELP, NEW_EXAMPLE, OUT, QUALITY_LESSONS, SPEED_LESSONS, TYPED, Case,
                        base_case, load_lessons)
from eval.configs import CONFIGS

MIN_REMAINING_USD = 3.0


# ── OpenRouter key spend ──────────────────────────────────────────────

def key_usage() -> dict:
    r = httpx.get("https://openrouter.ai/api/v1/key", timeout=20,
                  headers={"Authorization": f"Bearer {settings.OPENROUTER_API_KEY.get_secret_value()}"})
    d = r.json()["data"]
    return {"usage": d.get("usage"), "limit_remaining": d.get("limit_remaining")}


def guard_budget():
    remaining = key_usage().get("limit_remaining")
    if remaining is not None and remaining < MIN_REMAINING_USD:
        raise SystemExit(f"Stopping: only ${remaining:.2f} left on the key")


# ── Setup switching and per-call usage ────────────────────────────────

def use(config: str):
    for k, v in CONFIGS[config].items():
        setattr(settings, k, v)
    llm_mod.llm._model = None
    llm_mod.faded_llm._model = None
    llm_mod.check_llm._model = None


class Calls(BaseCallbackHandler):
    """Every model call in a run: model, tokens (reasoning included) and finish reason."""

    def __init__(self):
        self.calls: list[dict] = []
        self._start: dict = {}

    def on_chat_model_start(self, serialized, messages, *, run_id, **kw):
        self._start[run_id] = time.perf_counter()

    def on_llm_end(self, response, *, run_id, **kw):
        took = round(time.perf_counter() - self._start.pop(run_id, time.perf_counter()), 2)
        for gens in response.generations:
            msg = getattr(gens[0], "message", None)
            meta = getattr(msg, "response_metadata", {}) or {}
            usage = getattr(msg, "usage_metadata", None) or {}
            details = usage.get("output_token_details", {}) or {}
            self.calls.append({"s": took, "model": meta.get("model_name"), "id": meta.get("id"),
                               "finish": meta.get("finish_reason"), "in": usage.get("input_tokens"),
                               "out": usage.get("output_tokens"), "reasoning": details.get("reasoning")})

    def on_llm_error(self, error, *, run_id, **kw):
        self.calls.append({"error": f"{type(error).__name__}: {str(error)[:200]}"})


# ── One reply through the tutor graph ─────────────────────────────────

MODE = {"complete_example_node": "complete", "faded_example_node": "faded",
        "erroneous_example_node": "erroneous", "control_agent_node": "control"}


def run_case(config: str, case: Case) -> dict:
    lesson = case.lesson
    chat = Chat(user_id=1, chat_id=str(uuid.uuid4()), conversation=[], experiment_condition=case.condition,
                bkt_prob_mastery=case.mastery, original_problem=lesson["problem_description"],
                current_knowledge_component=lesson.get("knowledge_component", ""),
                error_trace=case.error_trace, trigger=case.trigger, student_code=case.student_code)
    state = build_initial_state(chat, case.history)
    if case.condition == "experimental" and case.allowance is not None:
        state = with_allowance(state, case.allowance)
    graph = build_tutor_graph().compile(checkpointer=MemorySaver())
    calls = Calls()
    cfg = {"configurable": {"thread_id": chat.chat_id}, "callbacks": [calls]}
    steps, t0 = [], time.perf_counter()
    last, err = t0, None
    try:
        for update in graph.stream(state, config=cfg, stream_mode="updates"):
            now = time.perf_counter()
            steps += [(node, round(now - last, 2)) for node in update]
            last = now
        final = graph.get_state(cfg).values
    except Exception as e:  # a failed reply is a result too
        final, err = {}, f"{type(e).__name__}: {str(e)[:300]}"
    total = round(time.perf_counter() - t0, 2)
    msgs = final.get("messages") or []
    text = getattr(msgs[-1], "content", "") if msgs else ""
    agent = next((n for n, _ in steps if n in MODE), None)
    mode = MODE.get(agent, "none")
    rtype = final.get("delivered_response_type")
    return {
        "config": config, "case": case.id, "lesson": lesson["problem_name"], "week": lesson["week"],
        "scenario": case.scenario, "mastery": case.mastery, "mode": mode, "total_s": total, "steps": steps,
        "retries": max(0, sum(1 for n, _ in steps if n in MODE) - 1), "calls": calls.calls, "error": err,
        "guardrail_passed": final.get("guardrail_passed"), "dean": final.get("dean_decision"),
        "dean_reason": final.get("dean_reason"), "rejected_drafts": final.get("rejected_drafts") or [],
        "response_type": rtype, "text": text,
        "checks": {
            "leak": checks.leak(lesson, text) if text else False,
            "syllabus": checks.syllabus_violations(lesson, text) if text else [],
            "structure": checks.structure_problems(text, mode, rtype) if text else ["no reply"],
            "quotes_student_code": checks.quotes_student_code(case.student_code, text),
        },
    }


def write(rows: list[dict], phase: str) -> Path:
    OUT.mkdir(exist_ok=True)
    path = OUT / f"{datetime.now():%Y%m%d-%H%M%S}-{phase}.jsonl"
    path.write_text("".join(json.dumps(r) + "\n" for r in rows))
    return path


def _line(r: dict) -> str:
    c = r["checks"]
    flags = [k for k in ("leak", "quotes_student_code") if c[k]] + c["structure"] + c["syllabus"]
    return (f"{r['config']:24} {r['lesson']:20} {r['scenario']:11} {r['mode']:9} {r['total_s']:6.1f}s "
            f"dean={r['dean']} retries={r['retries']} {'FLAGS ' + ', '.join(flags) if flags else ''}"
            f"{' ERROR ' + r['error'] if r['error'] else ''}")


# ── Phases ────────────────────────────────────────────────────────────

def help_case(lesson: dict, band: str, rep: int = 0, attempt: str | None = None) -> Case:
    case = base_case(lesson, "get_help", BANDS[band], rep, attempt)
    case.history = [{"sender": "user", "content": GET_HELP}]
    case.allowance = {"cap": 3, "used": 0, "earned": 1, "remaining": 1, "exhausted": False, "helpStarted": False}
    return case


def phase_speed(configs: list[str], repeats: int, limit: int | None = None):
    """Get help at each example level; one reply at a time, setups interleaved."""
    lessons = load_lessons()
    cases = [help_case(lessons[n], band, rep) for rep in range(repeats) for n in SPEED_LESSONS for band in BANDS]
    cases = cases[:limit] if limit else cases
    rows = []
    for i, case in enumerate(cases):
        if i % 6 == 0:
            guard_budget()
        order = configs if i % 2 == 0 else list(reversed(configs))
        for config in order:
            use(config)
            r = run_case(config, case)
            rows.append(r)
            print(_line(r), flush=True)
    return rows


def _chain(config: str, lesson: dict, i: int) -> list[dict]:
    """Get help, then New example, then one typed message (rotating scenarios)."""
    band = list(BANDS)[i % 3]
    first = help_case(lesson, band)
    r1 = run_case(config, first)
    example = r1["text"] or "(no example)"
    hist = [{"sender": "user", "content": GET_HELP}, {"sender": "assistant", "content": example}]

    second = base_case(lesson, "new_example", BANDS[band])
    second.history = hist + [{"sender": "user", "content": NEW_EXAMPLE}]
    second.trigger = "new_example"
    second.allowance = {"cap": 3, "used": 1, "earned": 2, "remaining": 1, "exhausted": False, "helpStarted": True}
    r2 = run_case(config, second)
    r2["similarity_to_first"] = checks.similarity(r1["text"], r2["text"])

    kind = list(TYPED)[i % len(TYPED)]
    typed = base_case(lesson, kind, BANDS[band])
    message = TYPED[kind] + (f"\n\n```python\n{typed.student_code}\n```" if kind == "fix_my_code" else "")
    typed.history = hist + [{"sender": "user", "content": message}]
    typed.trigger = "message"
    typed.allowance = {"cap": 3, "used": 1, "earned": 1, "remaining": 0, "exhausted": False, "helpStarted": True}
    r3 = run_case(config, typed)

    control = base_case(lesson, "control", BANDS[band])
    control.condition = "control"
    control.trigger = "message"
    control.history = [{"sender": "user", "content": TYPED["give_answer"] if i % 2 else "How should I approach this problem?"}]
    r4 = run_case(config, control)
    return [r1, r2, r3, r4]


def phase_quality(configs: list[str], workers: int):
    lessons = load_lessons()
    rows = []
    for config in configs:
        guard_budget()
        use(config)
        with ThreadPoolExecutor(workers) as pool:
            for chain in pool.map(lambda a: _chain(config, *a), [(lessons[n], i) for i, n in enumerate(QUALITY_LESSONS)]):
                for r in chain:
                    rows.append(r)
                    print(_line(r), flush=True)
    return rows


def _dean_state(lesson: dict, draft: str, modality: str, student_code: str) -> dict:
    return {"experiment_condition": "experimental", "pedagogical_modality": modality, "response_type": "new_example",
            "examples_remaining": 1, "messages": [{"role": "user", "content": GET_HELP}],
            "original_problem": lesson["problem_description"], "student_code": student_code, "draft_response": draft}


def dean_drafts(quality_file: Path) -> list[dict]:
    """Planted cases from clean examples of a quality run: each clean example as is
    (should pass), and broken versions that should be rejected."""
    lessons = load_lessons()
    rows = [json.loads(l) for l in quality_file.read_text().splitlines()]
    clean = [r for r in rows if r["scenario"] == "get_help" and r["dean"] == "approved" and not r["checks"]["leak"]
             and not r["checks"]["structure"] and not r["checks"]["syllabus"] and r["mode"] in ("complete", "faded", "erroneous")]
    seen, drafts = set(), []
    for r in clean:
        if r["lesson"] in seen:
            continue
        seen.add(r["lesson"])
        lesson, text = lessons[r["lesson"]], r["text"]
        modality = r["mode"].capitalize()
        block = checks.code_blocks(text)[0]
        student = base_case(lesson, "dean", 0.5).student_code
        drafts.append({"lesson": r["lesson"], "variant": "clean", "expect": "approved", "modality": modality,
                       "draft": text, "student_code": student})
        drafts.append({"lesson": r["lesson"], "variant": "leak", "expect": "rejected", "modality": modality,
                       "draft": text.replace(block, lesson["solution_code"], 1), "student_code": student})
        drafts.append({"lesson": r["lesson"], "variant": "fixes_student_code", "expect": "rejected", "modality": modality,
                       "draft": f"Your code just returns a fixed value. Replace it with this:\n\n```python\n{lesson['solution_code']}\n```",
                       "student_code": student})
        if r["mode"] == "complete":
            drafts.append({"lesson": r["lesson"], "variant": "wrong_modality", "expect": "rejected", "modality": "Faded",
                           "draft": text, "student_code": student})
            broken = block.replace("):", ")", 1).replace("return ", "retrun ", 1)
            drafts.append({"lesson": r["lesson"], "variant": "broken_code", "expect": "rejected", "modality": modality,
                           "draft": text.replace(block, broken, 1), "student_code": student})
    return drafts


def phase_dean(configs: list[str], quality_file: Path, workers: int):
    lessons = load_lessons()
    drafts = dean_drafts(quality_file)
    print(f"{len(drafts)} planted drafts from {quality_file.name}")
    rows = []
    for config in configs:
        guard_budget()
        use(config)

        def judge(d):
            t0 = time.perf_counter()
            try:
                out = dean_validation_node(_dean_state(lessons[d["lesson"]], d["draft"], d["modality"], d["student_code"]))
                decision = "rejected" if out.get("dean_retry") or out.get("dean_decision") in ("rejected", "limit") else "approved"
                reason, err = out.get("dean_reason"), None
            except Exception as e:
                decision, reason, err = "error", None, f"{type(e).__name__}: {str(e)[:200]}"
            return {**{k: d[k] for k in ("lesson", "variant", "expect", "modality")}, "config": config,
                    "decision": decision, "reason": reason, "s": round(time.perf_counter() - t0, 2), "error": err}

        with ThreadPoolExecutor(workers) as pool:
            for r in pool.map(judge, drafts):
                rows.append(r)
                print(f"{config:24} {r['lesson']:20} {r['variant']:18} expect={r['expect']:8} got={r['decision']:8} {r['reason'] or ''} {r['s']}s")
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("phase", choices=["speed", "quality", "dean"])
    ap.add_argument("--configs", default=",".join(CONFIGS))
    ap.add_argument("--repeats", type=int, default=3)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--limit", type=int, help="speed: only the first N cases (smoke test)")
    ap.add_argument("--quality-file", help="dean: the quality run to take clean examples from (default: latest)")
    args = ap.parse_args()
    configs = [c for c in args.configs.split(",") if c]
    unknown = set(configs) - set(CONFIGS)
    if unknown:
        raise SystemExit(f"Unknown configs: {unknown}")

    before = key_usage()
    print(f"key: ${before['usage']:.4f} used, ${before['limit_remaining']:.2f} left")
    if args.phase == "speed":
        rows = phase_speed(configs, args.repeats, args.limit)
    elif args.phase == "quality":
        rows = phase_quality(configs, args.workers)
    else:
        qf = Path(args.quality_file) if args.quality_file else sorted(OUT.glob("*-quality.jsonl"))[-1]
        rows = phase_dean(configs, qf, args.workers)
    path = write(rows, args.phase)
    after = key_usage()
    print(f"wrote {path} — this phase cost ${after['usage'] - before['usage']:.4f}, ${after['limit_remaining']:.2f} left")


if __name__ == "__main__":
    main()
