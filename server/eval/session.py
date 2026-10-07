"""Simulated class session with the real tutor and LLM-played students.

    cd server
    uv run --with pandas python -m eval.session --students 20 --lessons 6
    uv run --with pandas python -m eval.session --summary eval/out/<file>-session.jsonl

Each simulated student works through the first lessons of a week in lesson
order, under the system's real rules:

- groups: blocked randomization (blocks of 4) within each cohort (convex/experiment.ts);
- unlocks: the next lesson opens on a pass or after 3 failed Submits (convex/lessonAccess.ts);
- examples: experimental students earn one per failed Submit, up to 3 per
  lesson (convex/examples.ts); control students may ask the plain tutor;
- BKT: only the first Submit per lesson updates mastery (bkt.py);
- tutor: the real graph with production settings (V4.1 Flash writes, gpt-oss-120b checks);
- grading: the lesson's real visible + hidden tests, run locally.

Students are played by the production models (half V4.1 Flash, half
gpt-oss-120b), prompted as week-N novices with a misconception. Their first
attempt makes their misconception's mistake with a probability set by their
skill, so first-try pass rates are realistic; after that they revise their own
code from the failure summary and whatever help they got. Whether a student
fixes its code after an example is therefore emergent, not built in.

What this measures: the system under a live-session load, and how usable the
tutor's help is (fix rate after an example vs. after the plain tutor vs. alone).
It does not estimate learning gains: LLM students are not novices.

The session clock is simulated (reading, writing and thinking times) except for
the tutor's replies, which are real and counted in full. Simulated time runs
TIME_SCALE times faster in real time, so all students hit the tutor
concurrently, as in a class.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import re
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver

from ai.graph import build_tutor_graph
from ai.syllabus import allowed_python, topic_bugs
from bkt import initial_mastery, is_mastered, update_mastery
from config import settings
from model.chat import Chat
from services import submit_outcome, summarize_failures
from services.chat import build_initial_state, with_allowance

from eval import checks
from eval.cases import GET_HELP, NEW_EXAMPLE, OUT, load_lessons, run_tests
from eval.run import MODE, Calls, guard_budget, key_usage, use

COHORTS = {"SIM-W2": 2, "SIM-W4": 4}
SESSION_MINUTES = 30
TIME_SCALE = 10          # simulated seconds per real second (tutor waits are real and unscaled)
EXAMPLE_CAP = 3
UNLOCK_AFTER_FAILED = 3
STUDENT_MODELS = ["deepseek/deepseek-v4.1-flash", "openai/gpt-oss-120b"]

_CODE_RE = re.compile(r"```(?:python|py)?[ \t]*\n(.*?)```", re.DOTALL | re.IGNORECASE)
_print_lock = threading.Lock()


def log(msg: str):
    with _print_lock:
        print(msg, flush=True)


def sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))


# ── The student ───────────────────────────────────────────────────────

def student_llm(model: str) -> ChatOpenAI:
    return ChatOpenAI(
        model=model, api_key=settings.OPENROUTER_API_KEY.get_secret_value(),
        base_url="https://openrouter.ai/api/v1", temperature=0.8,
        extra_body={"provider": {"sort": "throughput", "require_parameters": True},
                    "reasoning": {"effort": "low"}, "max_tokens": 4000},
    )


def persona(lesson: dict, skill: float, misconception: str) -> str:
    level = "struggling" if skill < -0.5 else "average" if skill < 0.7 else "strong"
    return (
        f"You are role-playing a {level} first-year university student in week {lesson['week']} of an "
        "introductory Python course. Stay in character: you are a novice, not an expert.\n"
        f"You only know these Python features:\n{allowed_python(lesson.get('knowledge_component'))}\n"
        f"Your typical misconception this week: {misconception}.\n"
        "When asked for code, reply with ONLY one ```python code block containing the whole function, "
        "no explanation. Write it the way a student would: no comments that point out or hint at a mistake."
    )


def student_view(lesson: dict, results: list[dict]) -> str:
    """What the app shows after a Submit: tests passed, the example's expected
    output against the student's, and an error trace if the code crashed."""
    first = next((r for r in results if not r["hidden"]), None)
    lines = [f"{sum(r['passed'] for r in results)} of {len(results)} tests passed."]
    if first is not None:
        lines.append(f"Example input: {first['input']} | expected: {first['expected']} | your output: "
                     f"{first['stdout'] or '(nothing)'}")
    crash = next((r["stderr"] for r in results if r.get("stderr") and not r["hidden"]), "")
    if crash:
        lines.append("Error:\n" + crash.strip()[-600:])
    return "\n".join(lines)


def extract_code(text: str, fallback: str) -> str:
    m = _CODE_RE.search(text or "")
    return m.group(1).strip("\n") if m else fallback


class Student:
    def __init__(self, sid: str, cohort: str, group: str, skill: float, model: str, rng: random.Random):
        self.id, self.cohort, self.group, self.skill, self.model = sid, cohort, group, skill, model
        self.rng = rng
        self.llm = student_llm(model)
        self.mastery: dict[str, float] = {}
        self.clock = 0.0          # simulated session seconds
        self.events: list[dict] = []

    def think(self, low: float, high: float):
        """Simulated reading / writing time (slower for weaker students)."""
        secs = self.rng.uniform(low, high) * (1.3 - 0.2 * self.skill)
        self.clock += secs
        time.sleep(secs / TIME_SCALE)

    def ask(self, system: str, user: str) -> tuple[str, float]:
        t0 = time.perf_counter()
        try:
            out = self.llm.invoke([SystemMessage(content=system), HumanMessage(content=user)]).content or ""
        except Exception as e:  # a failed student call is logged and the student keeps their code
            out = f"(student model error: {type(e).__name__})"
        return out, time.perf_counter() - t0

    def first_attempt(self, lesson: dict, misconception: str) -> str:
        p_correct = sigmoid(0.2 + 1.2 * self.skill)
        mistaken = self.rng.random() > p_correct
        instruction = (
            "Write your first attempt. As this student, you make your misconception's mistake in it "
            "(a realistic novice error, not a syntax error), without noticing."
            if mistaken else "Write your first attempt, as carefully as you can."
        )
        text, _ = self.ask(persona(lesson, self.skill, misconception),
                           f"Exercise:\n{lesson['problem_description']}\n\nStarter code:\n```python\n"
                           f"{lesson['starter_code']}\n```\n\n{instruction}")
        return extract_code(text, lesson["starter_code"])

    def revise(self, lesson: dict, misconception: str, code: str, failure: str, help_text: str | None) -> str:
        # Modelling assumption: a student keeps their misconception unless something
        # convinces them otherwise. Alone, they may notice it from the test output
        # (likelier for stronger students); with help, the student model decides
        # from the tutor's reply itself.
        if help_text:
            helped = (f"\n\nThe tutor replied:\n<<<\n{help_text}\n>>>\nYou still believe your misconception is "
                      "right unless this reply convinces you otherwise. Use it the way a student would: learn from "
                      "it for your own exercise; do not copy an example written for a different problem.")
        elif self.rng.random() < sigmoid(-0.5 + self.skill):
            helped = "\n\nYou have no help. Looking at the output, you start to doubt your approach."
        else:
            helped = ("\n\nYou have no help, and you still believe your misconception is right; you look for "
                      "some other small thing to change.")
        text, _ = self.ask(persona(lesson, self.skill, misconception),
                           f"Exercise:\n{lesson['problem_description']}\n\nYour code:\n```python\n{code}\n```\n\n"
                           f"Your Submit failed:\n{failure}{helped}\n\nWrite your next attempt.")
        return extract_code(text, code)

    def question(self, lesson: dict, misconception: str, code: str, failure: str) -> str:
        text, _ = self.ask(persona(lesson, self.skill, misconception) +
                           "\nNow you are writing a short chat message to an AI tutor, in your own words "
                           "(one to three sentences, no code block). You don't know what's wrong with your code; "
                           "you still believe your misconception is right.",
                           f"Exercise:\n{lesson['problem_description']}\n\nYour code:\n```python\n{code}\n```\n\n"
                           f"Your Submit failed:\n{failure}\n\nWhat do you ask the tutor?")
        return (text or "I'm stuck, can you help?").strip()[:600]


# ── The tutor (real graph, production settings) ───────────────────────

def tutor(student: Student, lesson: dict, history: list[dict], trigger: str, code: str, failure: str,
          allowance: dict | None, mastery: float) -> dict:
    chat = Chat(user_id=1, chat_id=str(uuid.uuid4()), conversation=[], experiment_condition=student.group,
                bkt_prob_mastery=mastery,
                original_problem=lesson["problem_description"],
                current_knowledge_component=lesson["knowledge_component"],
                error_trace=failure, trigger=trigger, student_code=code)
    state = build_initial_state(chat, history)
    if student.group == "experimental" and allowance is not None:
        state = with_allowance(state, allowance)
    graph = build_tutor_graph().compile(checkpointer=MemorySaver())
    calls = Calls()
    cfg = {"configurable": {"thread_id": chat.chat_id}, "callbacks": [calls]}
    steps, t0, err = [], time.perf_counter(), None
    last = t0
    try:
        for update in graph.stream(state, config=cfg, stream_mode="updates"):
            now = time.perf_counter()
            steps += [(n, round(now - last, 2)) for n in update]
            last = now
        final = graph.get_state(cfg).values
    except Exception as e:
        final, err = {}, f"{type(e).__name__}: {str(e)[:200]}"
    msgs = final.get("messages") or []
    text = getattr(msgs[-1], "content", "") if msgs else ""
    agent = next((n for n, _ in steps if n in MODE), None)
    return {"text": text, "wait_s": round(time.perf_counter() - t0, 2), "steps": steps, "calls": calls.calls,
            "mode": MODE.get(agent, "none"), "dean": final.get("dean_decision"),
            "response_type": final.get("delivered_response_type"), "error": err,
            "guardrail_passed": final.get("guardrail_passed"),
            "mastery": chat.bkt_prob_mastery}


# ── One student's session ─────────────────────────────────────────────

def run_student(student: Student, lessons: list[dict]):
    def event(kind: str, lesson: dict, **data):
        student.events.append({"student": student.id, "cohort": student.cohort, "group": student.group,
                               "student_model": student.model, "skill": round(student.skill, 2),
                               "lesson": lesson["problem_name"], "position": lesson.get("position"),
                               "kind": kind, "clock_min": round(student.clock / 60, 2), **data})

    for lesson in lessons:
        if student.clock >= SESSION_MINUTES * 60:
            break
        kc = lesson["knowledge_component"]
        misconception = student.rng.choice([b.strip() for b in topic_bugs(kc).split(";") if b.strip()] or ["none"])
        history: list[dict] = []
        used = failed = 0
        graded, passed, last_help = False, False, None
        # Examples follow the mastery the student started the lesson with (routingMastery).
        start_mastery = student.mastery.get(kc, initial_mastery(kc))

        student.think(40, 100)  # read the exercise
        code = student.first_attempt(lesson, misconception)
        student.think(60, 240)  # write it

        while student.clock < SESSION_MINUTES * 60:
            results = run_tests(lesson, code)
            outcome = submit_outcome(results)
            passed = outcome == "passed"
            bkt = {}
            if not graded:
                prior = student.mastery.get(kc, initial_mastery(kc))
                student.mastery[kc] = update_mastery(prior, passed, kc)
                bkt = {"mastery_before": round(prior, 3), "mastery_after": round(student.mastery[kc], 3)}
                graded = True
            event("submit", lesson, attempt=failed + 1, outcome=outcome, passed=passed,
                  tests_passed=sum(r["passed"] for r in results), tests_total=len(results),
                  after_help=last_help, code=code, misconception=misconception, **bkt)
            if passed:
                break
            failed += 1
            if failed >= UNLOCK_AFTER_FAILED and student.rng.random() < 0.6:
                event("move_on", lesson, failed=failed)  # the next lesson is open now
                break
            if failed >= 5:
                event("give_up", lesson, failed=failed)
                break
            failure = summarize_failures(results)   # what the tutor sees (server-built)
            seen = student_view(lesson, results)    # what the student sees in the app
            help_text, last_help = None, "none"

            if student.group == "experimental" and used < min(EXAMPLE_CAP, failed):
                trigger = "get_help" if used == 0 else "new_example"
                ask = GET_HELP if used == 0 else NEW_EXAMPLE
                allowance = {"cap": EXAMPLE_CAP, "used": used, "earned": min(EXAMPLE_CAP, failed),
                             "remaining": min(EXAMPLE_CAP, failed) - used, "exhausted": False,
                             "helpStarted": bool(history)}
                history.append({"sender": "user", "content": ask})
                r = tutor(student, lesson, history, trigger, code, failure, allowance, start_mastery)
                student.clock += r["wait_s"]
                history.append({"sender": "assistant", "content": r["text"] or "(no reply)"})
                if r["response_type"] == "new_example":
                    used += 1
                help_text, last_help = r["text"], f"example:{r['mode']}" if r["response_type"] == "new_example" else "fallback"
                event("tutor", lesson, trigger=trigger, **_tutor_fields(r, lesson, code))
                student.think(40, 120)  # read the example
            elif student.group == "control" and student.rng.random() < 0.7:
                student.think(20, 50)   # type a question
                q = student.question(lesson, misconception, code, seen)
                history.append({"sender": "user", "content": q})
                r = tutor(student, lesson, history, "message", code, failure, None, start_mastery)
                student.clock += r["wait_s"]
                history.append({"sender": "assistant", "content": r["text"] or "(no reply)"})
                help_text, last_help = r["text"], "control_chat"
                event("tutor", lesson, trigger="message", question=q, **_tutor_fields(r, lesson, code))
                student.think(30, 90)   # read the reply

            new_code = student.revise(lesson, misconception, code, seen, help_text)
            copied = round(checks.similarity(f"```python\n{new_code}\n```", help_text or ""), 2) if help_text else 0.0
            code = new_code
            event("revise", lesson, copied_from_help=copied)
            student.think(40, 150)
        if not passed and student.clock >= SESSION_MINUTES * 60:
            event("time_up", lesson)


def _tutor_fields(r: dict, lesson: dict, code: str) -> dict:
    text = r["text"] or ""
    return {"wait_s": r["wait_s"], "mode": r["mode"], "dean": r["dean"], "response_type": r["response_type"],
            "error": r["error"], "reply": text, "steps": r["steps"], "calls": r["calls"],
            "mastery_at_reply": round(r["mastery"], 3),
            "leak": checks.leak(lesson, text) if text else False,
            "quotes_student_code": checks.quotes_student_code(code, text),
            "syllabus": checks.syllabus_violations(lesson, text) if r["mode"] != "control" else []}


# ── Setup and summary ─────────────────────────────────────────────────

def make_students(per_cohort: int, seed: int) -> list[Student]:
    rng = random.Random(seed)
    students = []
    for cohort in COHORTS:
        block: list[str] = []
        for i in range(per_cohort):
            if not block:
                block = ["experimental", "experimental", "control", "control"]
                rng.shuffle(block)
            group = block.pop()
            sid = f"{cohort}-{i + 1:02d}"
            students.append(Student(sid, cohort, group, rng.gauss(0, 1), STUDENT_MODELS[i % 2],
                                    random.Random(f"{seed}-{sid}")))
    return students


def summary(rows: list[dict]):
    import pandas as pd

    pd.set_option("display.width", 200)
    df = pd.DataFrame(rows)
    subs, tut = df[df["kind"] == "submit"], df[df["kind"] == "tutor"]

    print("\n── Tutor round trip under a live-session load ──")
    w = tut.groupby("group")["wait_s"]
    print(pd.DataFrame({"replies": w.size(), "p50_s": w.median(), "p90_s": w.quantile(.9),
                        "p95_s": w.quantile(.95), "max_s": w.max(),
                        "failed": tut.groupby("group")["error"].apply(lambda s: s.notna().sum()),
                        "fallback": tut.groupby("group")["dean"].apply(lambda s: (s == "rejected").mean())}).round(2).to_string())

    print("\n── Progress per student ──")
    per = subs.groupby(["group", "student", "lesson"])["passed"].any().groupby(["group", "student"]).agg(["size", "sum"])
    first = subs[subs["attempt"] == 1].groupby("group")["passed"].mean()
    moved = df[df["kind"] == "move_on"].groupby("group").size()
    print(pd.DataFrame({"students": per.groupby("group").size(), "lessons_reached": per.groupby("group")["size"].mean(),
                        "lessons_passed": per.groupby("group")["sum"].mean(), "first_try_pass": first,
                        "moved_on_after_3": moved}).fillna(0).round(2).to_string())

    print("\n── Does help fix the code? (the Submit right after each kind of help) ──")
    after = subs[subs["attempt"] > 1]
    t = after.groupby("after_help")["passed"].agg(["size", "mean"]).rename(columns={"size": "n", "mean": "next_submit_passes"})
    print(t.round(2).to_string())

    print("\n── Tutor behaviour on the students' real code ──")
    ex = tut[tut["group"] == "experimental"]
    print(f"examples by type: {ex[ex['response_type'] == 'new_example']['mode'].value_counts().to_dict()}")
    print(f"leaks: {int(tut['leak'].sum())} / {len(tut)} replies;  quoting student code: {int(tut['quotes_student_code'].sum())};  "
          f"syllabus flags (examples): {int(ex['syllabus'].apply(bool).sum())} / {len(ex)}")
    rev = df[df["kind"] == "revise"]
    print(f"revisions that copy the help (similarity > 0.8): {int((rev['copied_from_help'] > 0.8).sum())} / {len(rev)}")
    print("\n── By student model ──")
    print(subs.groupby("student_model")["passed"].agg(["size", "mean"]).round(2).to_string())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--students", type=int, default=20, help="per cohort")
    ap.add_argument("--lessons", type=int, default=6, help="first N lessons of each week, in order")
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--summary", help="only summarise an existing *-session.jsonl")
    args = ap.parse_args()
    if args.summary:
        summary([json.loads(l) for l in Path(args.summary).read_text().splitlines() if l.strip()])
        return

    use("F_v41+gptoss-check")  # the production setup
    guard_budget()
    before = key_usage()
    lessons_all = load_lessons()
    by_week = {w: sorted([l for l in lessons_all.values() if l["week"] == w], key=lambda l: l.get("position") or 99)[:args.lessons]
               for w in COHORTS.values()}
    students = make_students(args.students, args.seed)
    log(f"{len(students)} students: " + ", ".join(f"{c} {sum(s.cohort == c and s.group == 'experimental' for s in students)} exp / "
                                                f"{sum(s.cohort == c and s.group == 'control' for s in students)} ctrl" for c in COHORTS))
    t0 = time.perf_counter()

    def go(s: Student):
        run_student(s, by_week[COHORTS[s.cohort]])
        passed = sum(1 for e in s.events if e["kind"] == "submit" and e["passed"])
        log(f"  {s.id} {s.group:12} {s.model.split('/')[1]:22} skill={s.skill:+.2f} lessons passed={passed} "
            f"events={len(s.events)} sim={s.clock / 60:.0f} min")

    with ThreadPoolExecutor(len(students)) as pool:
        list(pool.map(go, students))
    rows = [e for s in students for e in s.events]
    OUT.mkdir(exist_ok=True)
    path = OUT / f"{datetime.now():%Y%m%d-%H%M%S}-session.jsonl"
    path.write_text("".join(json.dumps(r) + "\n" for r in rows))
    after = key_usage()
    log(f"wrote {path} — {len(rows)} events in {(time.perf_counter() - t0) / 60:.1f} min real time, "
        f"cost ${after['usage'] - before['usage']:.4f}, ${after['limit_remaining']:.2f} left")
    summary(rows)


if __name__ == "__main__":
    main()
