"""Faded and Erroneous example quality, judged by a stronger model.

    cd server
    uv run --with pandas python -m eval.examples                     # 16 lessons x Faded + Erroneous
    uv run --with pandas python -m eval.examples --kinds faded --repeat 2 --replies
    uv run --with pandas python -m eval.examples --rejudge eval/out/<run>-examples.jsonl
    uv run --with pandas python -m eval.examples --file eval/out/<run>-examples.jsonl --show 3

Generates Get help examples with the production setup at mastery 0.5 (Faded)
and 0.85 (Erroneous), runs the automatic checks (eval/checks.py), and asks a
judge model to score each example against the example prompts' own rules
(server/ai/nodes/faded_ebl_node.py, erroneous_ebl_node.py). For Faded, the
judge also fills in the blanks, and the completed code goes through the leak
check: a renamed copy of the exercise passes the exercise's tests.

--replies follows each Faded example with the student completing its blanks,
guessing wrong twice, or typing a request for a different example: every tutor
reply should come back as a follow-up, never a new example (new examples come
only from the buttons). --rejudge scores an earlier run's examples with the current
rubric, so prompt versions are compared by the same judge.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import datetime
from pathlib import Path
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from ai.syllabus import allowed_python, close_analog_allowed, topic_bugs
from config import settings

from eval import checks
from eval.cases import GET_HELP, OUT, QUALITY_LESSONS, load_attempts, load_lessons
from eval.run import guard_budget, help_case, key_usage, run_case, use

CONFIG = "F_v41+gptoss-check"
JUDGE_MODEL = "anthropic/claude-sonnet-5.5"
BAND = {"faded": "faded", "erroneous": "erroneous"}


class Verdict(BaseModel):
    completed_code: Optional[str] = Field(None, description="Faded only: the example's code with every blank filled in as intended, names unchanged")
    faded_step: Optional[str] = Field(None, description="Faded only: the step the blank(s) practise, in a few words")
    analogous_not_solution: bool = Field(description="A different task that needs the same idea: not the exercise itself, the exercise with new names, story or numbers, or its solution")
    follows_syllabus: bool = Field(description="Uses only the allowed Python features")
    targets_student_error: Optional[bool] = Field(description="The blanks / the bug are about the same idea the student's failure shows; null if a faded example cannot target this mistake")
    blanks_count: Optional[int] = Field(None, description="Faded only: number of blanks")
    blanks_well_placed: Optional[bool] = Field(None, description="Faded only: one blank on the step of the student's gap (a second only for a second missing step, never an easy filler line), sized to the gap, structure visible, one sensible completion, at least two thirds of the code worked out")
    hints_reveal_blank: Optional[bool] = Field(None, description="Faded only: a step label, a comment or the question gives away what goes in a blank")
    exactly_one_bug: Optional[bool] = Field(None, description="Erroneous only: exactly one intentional bug")
    bug_is_logic: Optional[bool] = Field(None, description="Erroneous only: a non-trivial logic bug (not a syntax error or typo)")
    hides_bug_location: Optional[bool] = Field(None, description="Erroneous only: the text does not reveal where the bug is or how to fix it")
    bug: Optional[str] = Field(None, description="Erroneous only: the bug and its fix, in one sentence")
    overall: int = Field(description="1-5: how good this example is for this student, as a teacher would judge it")
    issues: str = Field(description="The main problems, or 'none'")


_JUDGE_SYSTEM = """You are an experienced introductory programming instructor reviewing a worked \
example that an AI tutor gave a student after their code failed. Judge it strictly against the \
rules below and the student's situation. Be concrete in `issues`.

Faded example rules: a worked example of a DIFFERENT task that needs the step the student is \
missing; the exercise with new names, a new story or new numbers is not a different task (if the \
completed example, renamed, would pass the exercise, it is not analogous); every step labelled \
with what it achieves, not its code; ONE blank on the step that practises the student's gap, a \
second only for a second missing step, never an easy line (a lone return, an else:, a repeated \
print) blanked to make up the number; each blank marked `____`, sized to the gap (the key part of \
a line, or the whole line(s) of a step), with the structure visible (`if ____:`, not a blanked if \
line) and one sensible completion; at least two thirds of the code worked out; a sample call with \
its expected result; exactly one short guiding question after the code; no answer to the exercise.

Scoring a Faded example (research team, 2026-10-08): what matters most is that it aims at the \
student's failure, where a faded example can. Being close to the exercise (even the exercise in \
disguise) and hints that point to a blank are acceptable for now: record them, but do not lower \
`overall` for them. If a faded example cannot target the student's mistake (for example an extra \
wrong operation that no blank can show), set targets_student_error to null and do not lower \
`overall` for that either.

Erroneous example rules: a different but analogous problem; plausible code with EXACTLY ONE \
intentional, non-trivial logic bug from the topic's bug types; the bug sits in the same idea the \
student is getting wrong; the text asks the student only to find and fix it and does not reveal \
where it is; no answer to the exercise.

When <close_analog> is given (week-2 formula exercises), a Faded example need not have a different \
purpose: the same kind of calculation in a different setting counts as analogous, unless it uses the \
exercise's values, names or exact formula.

<student_mistake>, when given, is the student's actual mistake: known to you, not to the tutor. Use \
it to judge whether the example aims at the failure and whether the blank is on that step."""


def prompt_id(kind: str) -> str:
    """Short hash of the agent prompt that made an example, to tell prompt versions apart."""
    from ai.nodes import erroneous_ebl_node, faded_ebl_node
    mod = faded_ebl_node if kind.startswith("faded") else erroneous_ebl_node
    return hashlib.sha1(mod._SYSTEM_PROMPT.encode()).hexdigest()[:8]


def judge(llm, kind: str, lesson: dict, student_code: str, failure: str, text: str, note: str = "",
          mistake: str = "") -> dict:
    kc = lesson.get("knowledge_component")
    prompt = (
        f"Example type: {kind.capitalize()}\n\n<exercise>\n{lesson['problem_description']}\n</exercise>\n\n"
        f"<student_code>\n{student_code}\n</student_code>\n\n<failure>\n{failure}\n</failure>\n\n"
        + (f"<student_mistake>\n{mistake}\n</student_mistake>\n\n" if mistake else "")
        + f"<allowed_python>\n{allowed_python(kc)}\n</allowed_python>\n\n"
        f"<topic_bug_types>\n{topic_bugs(kc)}\n</topic_bug_types>\n\n"
        + (f"<close_analog>\nallowed\n</close_analog>\n\n" if close_analog_allowed(kc) else "")
        + (f"<note>\n{note}\n</note>\n\n" if note else "")
        + f"<tutor_example>\n{text}\n</tutor_example>"
    )
    try:
        v = llm.with_structured_output(Verdict).invoke([SystemMessage(content=_JUDGE_SYSTEM), HumanMessage(content=prompt)])
        return v.model_dump()
    except Exception as e:
        return {"error": f"{type(e).__name__}: {str(e)[:200]}"}


def runs_cleanly(text: str) -> Optional[bool]:
    """Erroneous: the example's code executes (the bug is a logic bug, so it should still run)."""
    blocks = checks.code_blocks(text)
    if not blocks:
        return None
    try:
        r = subprocess.run([sys.executable, "-c", blocks[0]], capture_output=True, text=True, timeout=5)
        return r.returncode == 0
    except subprocess.TimeoutExpired:
        return False


_WHOLE_LINE_BLANK = re.compile(r"^\s*_{3,}\s*(#.*)?$")
_SAMPLE_LINE = re.compile(r"^print\(.*\)\s*#\s*(.+)$")
_EXPECTED_PREFIX = re.compile(r"^(expected( result)?|prints?|returns?|gives?|should (give|print|return)|output|→|->|=>)\s*:?\s*", re.I)


def sample_matches(completed: str) -> Optional[bool]:
    """Faded: the completed example prints what its sample-call comments say (None: nothing to check)."""
    expected = [m.group(1) for line in completed.splitlines() if (m := _SAMPLE_LINE.match(line.strip()))]
    if not expected:
        return None
    try:
        r = subprocess.run([sys.executable, "-c", completed], capture_output=True, text=True, timeout=5)
    except subprocess.TimeoutExpired:
        return False
    norm = lambda v: v.strip().replace('"', "'").strip("'")
    printed = {norm(line) for line in r.stdout.splitlines()}
    for comment in expected:
        value = norm(re.sub(r"\s+\(.*\)$", "", _EXPECTED_PREFIX.sub("", comment.strip())))
        if not ("empty" in value and "" in printed) and value not in printed:
            return False
    return r.returncode == 0


def faded_checks(lesson: dict, text: str, verdict: dict) -> dict:
    """Faded: whole-line blanks, a sample call (and whether the completed code prints what it says),
    and whether the judge's completed code solves the exercise."""
    code = "\n".join(checks.code_blocks(text))
    completed = verdict.get("completed_code") or ""
    if "```" in completed:
        completed = "\n".join(checks.code_blocks(completed))
    lines = code.splitlines()
    return {"whole_line_blanks": sum(1 for line in lines if _WHOLE_LINE_BLANK.match(line)),
            "step_labels": sum(1 for line in lines if re.match(r"\s*#\s*Step\s*\d", line)),
            "body_lines": sum(1 for line in lines if line.strip() and not line.strip().startswith(("#", "def ", "print("))),
            "hint_comments": sum(1 for line in lines if "# ???" in line),
            "sample_call": checks.has_sample_call(code),
            "sample_ok": sample_matches(completed) if completed.strip() else None,
            "filled_leak": checks.leak(lesson, f"```python\n{completed}\n```") if completed.strip() else None}


def auto_checks(kind: str, r: dict) -> dict:
    blocks = checks.code_blocks(r["text"])
    return {"mode_delivered": r["mode"], "dean": r["dean"], "retries": r["retries"], "seconds": r["total_s"],
            "leak": r["checks"]["leak"], "syllabus": r["checks"]["syllabus"], "structure": r["checks"]["structure"],
            "blanks_in_code": sum(len(checks._BLANK_RE.findall(b)) for b in blocks),
            "code_lines": sum(len([l for l in b.splitlines() if l.strip()]) for b in blocks),
            "runs_cleanly": runs_cleanly(r["text"]) if kind == "erroneous" else None, "steps": r["steps"]}


ANSWER_MISTAKE = "Returns the first example's expected answer instead of computing it from the inputs."


def generate(kind: str, lesson: dict, rep: int = 0, attempt: Optional[dict] = None) -> tuple:
    """attempt: the lesson's realistic wrong attempt (eval/attempts.json), else the returned answer."""
    case = help_case(lesson, BAND[kind], rep, attempt["code"] if attempt else None)
    return kind, lesson, rep, case, run_case(CONFIG, case), attempt


def _reasoning(kind: str) -> str:
    agent = settings.OPENROUTER_AGENT_REASONING
    return (settings.OPENROUTER_FADED_REASONING or agent) if kind == "faded" else agent


def score(kind: str, lesson: dict, rep: int, case, r: dict, attempt: Optional[dict], llm) -> dict:
    text = r["text"]
    mistake = attempt["mistake"] if attempt else ANSWER_MISTAKE
    verdict = (judge(llm, kind, lesson, case.student_code, case.error_trace, text, mistake=mistake)
               if llm and text and r["mode"] == kind else {})
    auto = auto_checks(kind, r)
    if kind == "faded":
        auto.update(faded_checks(lesson, text, verdict))
    return {"kind": kind, "lesson": lesson["problem_name"], "week": lesson["week"], "rep": rep,
            "prompt": prompt_id(kind), "reasoning": _reasoning(kind), "judge_model": JUDGE_MODEL if llm else None,
            "failure_kind": "attempt" if attempt else "answer", "mistake": mistake,
            "student_code": case.student_code, "failure": case.error_trace,
            "text": text, "auto": auto, "judge": verdict}


def rejudge(row: dict, lesson: dict, llm) -> dict:
    """An earlier run's example, scored with the current rubric (and Faded checks)."""
    ok = row["text"] and row["auto"]["mode_delivered"] == row["kind"]
    verdict = (judge(llm, row["kind"], lesson, row["student_code"], row["failure"], row["text"],
                     mistake=row.get("mistake", "")) if ok else {})
    auto = {**row["auto"], **(faded_checks(lesson, row["text"], verdict) if row["kind"] == "faded" else {})}
    return {**row, "prompt": row.get("prompt") or "earlier", "rejudged": True, "auto": auto, "judge": verdict}


# ── The student's replies to a Faded example ─────────────────────────

_COMPLETED = "Here's the example with my answers in the blanks:\n```python\n{code}\n```"
_STUCK = ["I'm not sure. Is it `print(result)`?", "Still stuck. Is it `result = 0`?"]
_DIFFERENT = ["Can you show me a different example?"]
_MESSAGES = {"stuck": _STUCK, "different": _DIFFERENT}
# A typed message after Get help: its one example is used, so none remain.
_AFTER_HELP = {"cap": 3, "used": 1, "earned": 1, "remaining": 0, "exhausted": False, "helpStarted": True}


def replies(row: dict, lesson: dict, branch: str) -> dict:
    """The student completes the example's blanks, or guesses wrong twice. Every tutor reply should be a
    follow-up (feedback, the completed code, or after two tries how to work out the blank): a reply
    labelled as a new example, with none left, is swapped for the example-limit message."""
    case = replace(help_case(lesson, "faded", row.get("rep", 0)), student_code=row["student_code"],
                   error_trace=row["failure"])
    history = [{"sender": "user", "content": GET_HELP}, {"sender": "assistant", "content": row["text"]}]
    messages = [_COMPLETED.format(code=row["judge"]["completed_code"])] if branch == "completed" else _MESSAGES[branch]
    out = []
    for msg in messages:
        history.append({"sender": "user", "content": msg})
        r = run_case(CONFIG, replace(case, trigger="message", history=list(history), allowance=_AFTER_HELP))
        history.append({"sender": "assistant", "content": r["text"] or "(no reply)"})
        out.append({"text": r["text"], "type": r["response_type"], "dean": r["dean"], "dean_reason": r["dean_reason"],
                    "retries": r["retries"], "seconds": r["total_s"],
                    "shows_code": bool(checks.code_blocks(r["text"])), "rejected_drafts": r["rejected_drafts"]})
    return {"kind": "faded_reply", "branch": branch, "lesson": lesson["problem_name"], "week": lesson["week"],
            "rep": row.get("rep", 0), "prompt": prompt_id("faded"), "first_text": row["text"], "replies": out}


# ── Reporting ─────────────────────────────────────────────────────────

def _labels(auto: dict):
    """Step labels in a Faded example (runs from 2026-10-07 20:30 stored the count under "steps")."""
    return auto.get("step_labels", auto["steps"] if isinstance(auto.get("steps"), int) else None)


def summary(rows: list[dict]):
    import pandas as pd

    pd.set_option("display.width", 240)
    flat = []
    for r in rows:
        j, a = r["judge"], r["auto"]
        flat.append({"kind": r["kind"], "prompt": r.get("prompt", "?"), "reasoning": r.get("reasoning", "?"),
                     "lesson": r["lesson"], "week": r["week"], "steps": _labels(a), "body": a.get("body_lines"),
                     "rep": r.get("rep", 0), "delivered": a["mode_delivered"], "dean": a["dean"], "s": a["seconds"],
                     "leak": a["leak"], "blanks": a["blanks_in_code"], "whole": a.get("whole_line_blanks"),
                     "sample": a.get("sample_call"), "sample_ok": a.get("sample_ok"),
                     "filled_leak": a.get("filled_leak"), "runs": a["runs_cleanly"], "overall": j.get("overall"),
                     "analogous": j.get("analogous_not_solution"), "syllabus_judge": j.get("follows_syllabus"),
                     "targets_error": j.get("targets_student_error"), "blanks_ok": j.get("blanks_well_placed"),
                     "hints_reveal": j.get("hints_reveal_blank"), "one_bug": j.get("exactly_one_bug"),
                     "logic_bug": j.get("bug_is_logic"), "hides_bug": j.get("hides_bug_location")})
    df = pd.DataFrame(flat)
    ok = lambda d, c: f"{d[c].astype(float).mean():.0%}" if d[c].notna().any() else "-"
    for (kind, prompt, reasoning), d in df.groupby(["kind", "prompt", "reasoning"], sort=False):
        faded = kind == "faded"
        print(f"\n── {kind.capitalize()} · prompt {prompt} · reasoning {reasoning} ({len(d)} examples) ──")
        cols = (["delivered", "dean", "s", "steps", "body", "blanks", "whole", "sample", "sample_ok", "filled_leak", "overall", "analogous",
                 "targets_error", "blanks_ok", "hints_reveal"]
                if faded else ["delivered", "dean", "s", "runs", "overall", "analogous", "targets_error",
                               "syllabus_judge", "one_bug", "logic_bug", "hides_bug"])
        print(d.set_index(["week", "lesson", "rep"])[cols].to_string())
        extra = (f"blanks well placed {ok(d, 'blanks_ok')} · hints reveal a blank {ok(d, 'hints_reveal')} · "
                 f"sample call {ok(d, 'sample')} (output right {ok(d, 'sample_ok')}) · completed example solves the "
                 f"exercise {ok(d, 'filled_leak')}"
                 if faded else f"exactly one bug {ok(d, 'one_bug')}, logic bug {ok(d, 'logic_bug')}, "
                               f"hides bug {ok(d, 'hides_bug')}, runs {ok(d, 'runs')}")
        print(f"mean overall {d['overall'].mean():.2f}/5 · analogous {ok(d, 'analogous')} · targets the error "
              f"{ok(d, 'targets_error')} · within syllabus (judge) {ok(d, 'syllabus_judge')} · {extra} · "
              f"leaks {int(d['leak'].sum())} · median {d['s'].median():.1f} s")


def replies_summary(rows: list[dict]):
    for branch in ("completed", "stuck", "different"):
        d = [r for r in rows if r["branch"] == branch]
        if not d:
            continue
        turns = [x for r in d for x in r["replies"]]
        count = lambda f: sum(1 for x in turns if f(x))
        print(f"\n── Faded replies · student {branch} · prompt {d[0]['prompt']} ({len(d)} conversations, "
              f"{len(turns)} replies) ──")
        for r in d:
            print(f"  {r['lesson']:20} " + "   ".join(f"{x['type']} / {x['dean']}" + (" / code" if x["shows_code"] else "")
                                                   for x in r["replies"]))
        print(f"follow-up {count(lambda x: x['type'] == 'follow_up')}/{len(turns)} · example-limit message "
              f"{count(lambda x: x['dean'] == 'limit')} · Dean fallback {count(lambda x: x['dean'] == 'rejected')} · "
              f"last reply shows code {sum(1 for r in d if r['replies'][-1]['shows_code'])}/{len(d)} · "
              f"new example delivered {count(lambda x: x['type'] == 'new_example')} · "
              f"sent back as a typed new example {count(lambda x: x.get('dean_reason') == 'TYPED_NEW_EXAMPLE')}")


def show(rows: list[dict], n: int):
    """Print n examples of each kind, with the judge's notes."""
    seen: dict[str, int] = {}
    for r in rows:
        kind = r["kind"]
        if seen.get(kind, 0) >= n or not r.get("judge"):
            continue
        seen[kind] = seen.get(kind, 0) + 1
        j = r["judge"]
        print(f"\n{'═' * 100}\n{kind} · {r['lesson']} (week {r['week']}) · overall {j.get('overall')}/5\n"
              f"student: {r['student_code']!r}\n{'─' * 100}\n{r['text']}\n{'─' * 100}\njudge: {j.get('issues')}")


def _load(path: str) -> list[dict]:
    return [json.loads(l) for l in Path(path).read_text().splitlines() if l.strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--kinds", default="faded,erroneous", help="comma-separated: faded, erroneous")
    ap.add_argument("--repeat", type=int, default=1, help="examples per lesson and kind")
    ap.add_argument("--lessons", help="comma-separated lesson names (default: the 16 quality lessons)")
    ap.add_argument("--weeks", help="comma-separated weeks: every lesson in them, in course order")
    ap.add_argument("--gen-workers", type=int, help="examples generated at once (default --workers; 1 times each "
                                                     "reply as a single student would see it)")
    ap.add_argument("--replies", nargs="?", const="", metavar="FILE",
                    help="Faded: the student completes each example's blanks, or is stuck twice "
                         "(this run's examples, or those in FILE)")
    ap.add_argument("--failures", choices=("attempts", "answer"), default="attempts",
                    help="how the simulated student fails: a realistic attempt (eval/attempts.json, where the lesson "
                         "has one) or returning the first example's answer")
    ap.add_argument("--faded-prompt", metavar="FILE", help="run the Faded agent with this prompt (an A/B variant)")
    ap.add_argument("--faded-reasoning", help="the Faded agent's reasoning effort (default: the agent's)")
    ap.add_argument("--no-judge", action="store_true",
                    help="generate and run the automatic checks only (score the examples another way)")
    ap.add_argument("--rejudge", help="score an existing *-examples.jsonl with the current rubric")
    ap.add_argument("--file", help="summarise / show an existing *-examples.jsonl")
    ap.add_argument("--show", type=int, default=0, help="print N examples of each type")
    args = ap.parse_args()
    kinds = [k.strip() for k in args.kinds.split(",")]
    if args.file:
        rows = _load(args.file)
    else:
        use(CONFIG)
        if args.faded_prompt:
            from ai.nodes import faded_ebl_node
            faded_ebl_node._SYSTEM_PROMPT = Path(args.faded_prompt).read_text()
        if args.faded_reasoning:
            settings.OPENROUTER_FADED_REASONING = args.faded_reasoning
        guard_budget()
        before = key_usage()
        lessons = load_lessons()
        judge_llm = None if args.no_judge else ChatOpenAI(model=JUDGE_MODEL, api_key=settings.OPENROUTER_API_KEY.get_secret_value(),
                               base_url="https://openrouter.ai/api/v1", temperature=0,
                               extra_body={"provider": {"require_parameters": True}, "max_tokens": 6000})
        with ThreadPoolExecutor(args.workers) as pool:
            if args.replies:  # an earlier run's examples: only the replies
                rows, examples = [], _load(args.replies)
            elif args.rejudge:
                old = [r for r in _load(args.rejudge) if r["kind"] in kinds]
                rows = examples = list(pool.map(lambda r: rejudge(r, lessons[r["lesson"]], judge_llm), old))
            else:
                if args.weeks:
                    weeks = {int(w) for w in args.weeks.split(",")}
                    order = sorted(lessons.values(), key=lambda l: (l["week"], l.get("position", 0)))
                    names = [l["problem_name"] for l in order if l["week"] in weeks]
                else:
                    names = args.lessons.split(",") if args.lessons else QUALITY_LESSONS
                attempts = load_attempts() if args.failures == "attempts" else {}
                jobs = [(k, lessons[n], rep, attempts.get(n)) for rep in range(args.repeat) for n in names for k in kinds]
                with ThreadPoolExecutor(args.gen_workers or args.workers) as gen_pool:
                    generated = list(gen_pool.map(lambda j: generate(*j), jobs))
                rows = examples = list(pool.map(lambda g: score(*g, judge_llm), generated))
            if args.replies is not None:
                firsts = [r for r in examples if r["kind"] == "faded" and r.get("rep", 0) == 0
                          and (r["judge"].get("completed_code") or "").strip()]
                jobs = [(r, branch) for r in firsts for branch in ("completed", "stuck", "different")]
                rows = rows + list(pool.map(lambda j: replies(j[0], lessons[j[0]["lesson"]], j[1]), jobs))
        OUT.mkdir(exist_ok=True)
        path = OUT / f"{datetime.now():%Y%m%d-%H%M%S}-examples.jsonl"
        path.write_text("".join(json.dumps(r) + "\n" for r in rows))
        after = key_usage()
        print(f"wrote {path} — cost ${after['usage'] - before['usage']:.4f}, ${after['limit_remaining']:.2f} left")
    examples = [r for r in rows if r["kind"] != "faded_reply"]
    if examples and not args.no_judge:
        summary(examples)
    replies_summary([r for r in rows if r["kind"] == "faded_reply"])
    if args.show:
        show(examples, args.show)


if __name__ == "__main__":
    main()
