"""Faded and Erroneous example quality, judged by a stronger model.

    cd server
    uv run --with pandas python -m eval.examples                 # 16 lessons x Faded + Erroneous
    uv run --with pandas python -m eval.examples --show 3        # print a few examples of each type

Generates Get help examples with the production setup at mastery 0.5 (Faded)
and 0.85 (Erroneous), runs the automatic checks (eval/checks.py), and asks a
judge model to score each example against the example prompts' own rules
(server/ai/nodes/faded_ebl_node.py, erroneous_ebl_node.py).
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from ai.syllabus import allowed_python, topic_bugs
from config import settings

from eval import checks
from eval.cases import OUT, QUALITY_LESSONS, load_lessons
from eval.run import guard_budget, help_case, key_usage, run_case, use

JUDGE_MODEL = "anthropic/claude-sonnet-5.5"
BAND = {"faded": "faded", "erroneous": "erroneous"}


class Verdict(BaseModel):
    analogous_not_solution: bool = Field(description="A different but analogous problem, not the exercise itself or its solution")
    follows_syllabus: bool = Field(description="Uses only the allowed Python features")
    targets_student_error: bool = Field(description="The blanks / the bug are about the same idea the student's failure shows")
    blanks_count: Optional[int] = Field(None, description="Faded only: number of blanks")
    blanks_well_placed: Optional[bool] = Field(None, description="Faded only: 1-2 blanks, at most a third of the lines, on the step that practises the topic, solvable from the rest")
    exactly_one_bug: Optional[bool] = Field(None, description="Erroneous only: exactly one intentional bug")
    bug_is_logic: Optional[bool] = Field(None, description="Erroneous only: a non-trivial logic bug (not a syntax error or typo)")
    hides_bug_location: Optional[bool] = Field(None, description="Erroneous only: the text does not reveal where the bug is or how to fix it")
    bug: Optional[str] = Field(None, description="Erroneous only: the bug and its fix, in one sentence")
    overall: int = Field(description="1-5: how good this example is for this student, as a teacher would judge it")
    issues: str = Field(description="The main problems, or 'none'")


_JUDGE_SYSTEM = """You are an experienced introductory programming instructor reviewing a worked \
example that an AI tutor gave a student after their code failed. Judge it strictly against the \
rules below and the student's situation. Be concrete in `issues`.

Faded example rules: a different but analogous problem; the code under 1-2 steps left blank for \
the student (each marked `____  # ???: ...`), never more than a third of the lines, on the step(s) \
that practise the topic; the blanks target the conceptual gap shown by the student's failure; \
exactly one guiding question after the code; no answer to the exercise.

Erroneous example rules: a different but analogous problem; plausible code with EXACTLY ONE \
intentional, non-trivial logic bug from the topic's bug types; the bug sits in the same idea the \
student is getting wrong; the text asks the student only to find and fix it and does not reveal \
where it is; no answer to the exercise."""


def judge(llm, kind: str, lesson: dict, case, text: str) -> dict:
    prompt = (
        f"Example type: {kind.capitalize()}\n\n<exercise>\n{lesson['problem_description']}\n</exercise>\n\n"
        f"<student_code>\n{case.student_code}\n</student_code>\n\n<failure>\n{case.error_trace}\n</failure>\n\n"
        f"<allowed_python>\n{allowed_python(lesson.get('knowledge_component'))}\n</allowed_python>\n\n"
        f"<topic_bug_types>\n{topic_bugs(lesson.get('knowledge_component'))}\n</topic_bug_types>\n\n"
        f"<tutor_example>\n{text}\n</tutor_example>"
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


def one(kind: str, lesson: dict, llm) -> dict:
    case = help_case(lesson, BAND[kind])
    r = run_case("F_v41+gptoss-check", case)
    text = r["text"]
    blocks = checks.code_blocks(text)
    auto = {"mode_delivered": r["mode"], "dean": r["dean"], "retries": r["retries"], "seconds": r["total_s"],
            "leak": r["checks"]["leak"], "syllabus": r["checks"]["syllabus"], "structure": r["checks"]["structure"],
            "blanks_in_code": sum(len(checks._BLANK_RE.findall(b)) for b in blocks),
            "code_lines": sum(len([l for l in b.splitlines() if l.strip()]) for b in blocks),
            "runs_cleanly": runs_cleanly(text) if kind == "erroneous" else None}
    verdict = judge(llm, kind, lesson, case, text) if text and r["mode"] == kind else {}
    return {"kind": kind, "lesson": lesson["problem_name"], "week": lesson["week"], "student_code": case.student_code,
            "failure": case.error_trace, "text": text, "auto": auto, "judge": verdict}


def summary(rows: list[dict]):
    import pandas as pd

    pd.set_option("display.width", 220)
    flat = []
    for r in rows:
        j, a = r["judge"], r["auto"]
        flat.append({"kind": r["kind"], "lesson": r["lesson"], "week": r["week"], "delivered": a["mode_delivered"],
                     "dean": a["dean"], "s": a["seconds"], "leak": a["leak"], "syllabus_auto": bool(a["syllabus"]),
                     "blanks": a["blanks_in_code"], "runs": a["runs_cleanly"], "overall": j.get("overall"),
                     "analogous": j.get("analogous_not_solution"), "syllabus_judge": j.get("follows_syllabus"),
                     "targets_error": j.get("targets_student_error"), "blanks_ok": j.get("blanks_well_placed"),
                     "one_bug": j.get("exactly_one_bug"), "logic_bug": j.get("bug_is_logic"),
                     "hides_bug": j.get("hides_bug_location")})
    df = pd.DataFrame(flat)
    for kind, d in df.groupby("kind"):
        print(f"\n── {kind.capitalize()} ({len(d)} examples) ──")
        cols = ["delivered", "dean", "s", "leak", "blanks" if kind == "faded" else "runs", "overall", "analogous",
                "targets_error", "syllabus_judge"] + (["blanks_ok"] if kind == "faded" else ["one_bug", "logic_bug", "hides_bug"])
        print(d.set_index(["week", "lesson"])[cols].to_string())
        ok = lambda c: f"{d[c].mean():.0%}" if d[c].notna().any() else "-"
        extra = (f"blanks well placed {ok('blanks_ok')}" if kind == "faded"
                 else f"exactly one bug {ok('one_bug')}, logic bug {ok('logic_bug')}, hides bug {ok('hides_bug')}, runs {ok('runs')}")
        print(f"mean overall {d['overall'].mean():.2f}/5 · analogous {ok('analogous')} · targets the error {ok('targets_error')} · "
              f"within syllabus (judge) {ok('syllabus_judge')} · {extra} · leaks {int(d['leak'].sum())} · median {d['s'].median():.1f} s")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--file", help="summarise / show an existing *-examples.jsonl")
    ap.add_argument("--show", type=int, default=0, help="print N examples of each type")
    args = ap.parse_args()
    if args.file:
        rows = [json.loads(l) for l in Path(args.file).read_text().splitlines() if l.strip()]
    else:
        use("F_v41+gptoss-check")
        guard_budget()
        before = key_usage()
        lessons = load_lessons()
        judge_llm = ChatOpenAI(model=JUDGE_MODEL, api_key=settings.OPENROUTER_API_KEY.get_secret_value(),
                               base_url="https://openrouter.ai/api/v1", temperature=0,
                               extra_body={"provider": {"require_parameters": True}, "max_tokens": 4000})
        jobs = [(k, lessons[n]) for n in QUALITY_LESSONS for k in ("faded", "erroneous")]
        with ThreadPoolExecutor(args.workers) as pool:
            rows = list(pool.map(lambda j: one(j[0], j[1], judge_llm), jobs))
        OUT.mkdir(exist_ok=True)
        path = OUT / f"{datetime.now():%Y%m%d-%H%M%S}-examples.jsonl"
        path.write_text("".join(json.dumps(r) + "\n" for r in rows))
        after = key_usage()
        print(f"wrote {path} — cost ${after['usage'] - before['usage']:.4f}, ${after['limit_remaining']:.2f} left")
    summary(rows)


if __name__ == "__main__":
    main()
