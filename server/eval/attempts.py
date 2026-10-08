"""Realistic wrong attempts, one per lesson, for the examples test.

    cd server
    uv run python -m eval.attempts --weeks 2,3,4      # adds missing lessons to eval/attempts.json

The examples test used to fail every student the same way (returning the first
example's answer), which leaves the whole method missing, so the tutor and the
judge had to guess which step is "the gap". A real first Submit is usually a
genuine attempt with one mistake. The judge model writes one per lesson, as a
student in that week would, with exactly one typical mistake (preferably one
of the topic's bug types, ai/syllabus.py); an attempt is kept only if it runs
and fails at least one visible test. The mistake is recorded for the judge and
never shown to the tutor.
"""

from __future__ import annotations

import argparse
import json
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from ai.syllabus import allowed_python, topic_bugs
from config import settings

from eval.cases import ATTEMPTS, load_attempts, load_lessons, run_tests

MODEL = "anthropic/claude-sonnet-5.5"


class Attempt(BaseModel):
    code: str = Field(description="The student's whole function, as they would submit it")
    mistake: str = Field(description="The one mistake, in one sentence, naming the step of the method it is in")


_SYSTEM = """You write realistic first attempts by students in an introductory Python course, to test an AI \
tutor. Each attempt is a genuine try at the whole exercise with exactly one mistake of the kind a novice makes."""


def _prompt(lesson: dict, feedback: str = "") -> str:
    kc = lesson.get("knowledge_component")
    tests = "\n".join(f"input {t['input']!r} -> expected output {t['expectedOutput']!r}"
                      for t in lesson["testCases"] if not t.get("hidden"))
    return (
        f"<exercise>\n{lesson['problem_description']}\n</exercise>\n"
        f"<starter_code>\n{lesson['starter_code']}\n</starter_code>\n"
        f"<reference_solution>\n{lesson['solution_code']}\n</reference_solution>\n"
        f"<allowed_python>\n{allowed_python(kc)}\n</allowed_python>\n"
        f"<typical_bugs>\n{topic_bugs(kc)}\n</typical_bugs>\n"
        f"<visible_tests>\n{tests}\n</visible_tests>\n\n"
        f"Write the code a week-{lesson['week']} student would submit on a first try: the whole function, a genuine "
        "attempt at the exercise with exactly ONE realistic mistake, preferably one of <typical_bugs>, otherwise a common "
        "novice mistake for this exercise (for example / instead of //, an off-by-one index, a wrong boundary, a missed "
        "edge case or a forgotten conversion). Use only <allowed_python> and what the reference solution uses. It must "
        "run without an error on the visible tests and fail at least one of them. Add no comment that points at the mistake."
        + (f"\n\nYour last attempt was not usable: {feedback} Write a new one." if feedback else "")
    )


def check(lesson: dict, code: str) -> str:
    """Why an attempt can't be used ('' if it can)."""
    visible = [r for r in run_tests(lesson, code) if not r["hidden"]]
    if any(r["status_id"] not in (3, 4) for r in visible):
        return "it raised an error or timed out on a visible test."
    if all(r["passed"] for r in visible):
        return "it passed every visible test; it must fail at least one."
    return ""


def make(llm, lesson: dict) -> Optional[dict]:
    feedback = ""
    for _ in range(3):
        try:
            a = llm.with_structured_output(Attempt).invoke(
                [SystemMessage(content=_SYSTEM), HumanMessage(content=_prompt(lesson, feedback))])
        except Exception as e:  # one failed call shouldn't lose the other lessons' attempts
            print(f"{lesson['problem_name']}: {type(e).__name__}: {str(e)[:120]}")
            return None
        feedback = check(lesson, a.code)
        if not feedback:
            return {"code": a.code, "mistake": a.mistake, "model": MODEL}
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--weeks", default="2,3,4", help="comma-separated weeks")
    ap.add_argument("--lessons", help="comma-separated lesson names (instead of --weeks)")
    ap.add_argument("--force", action="store_true", help="rewrite lessons that already have an attempt")
    args = ap.parse_args()
    lessons = load_lessons()
    if args.lessons:
        names = args.lessons.split(",")
    else:
        weeks = {int(w) for w in args.weeks.split(",")}
        names = [l["problem_name"] for l in sorted(lessons.values(), key=lambda l: (l["week"], l.get("position", 0)))
                 if l["week"] in weeks]
    attempts = load_attempts()
    todo = [n for n in names if args.force or n not in attempts]
    llm = ChatOpenAI(model=MODEL, api_key=settings.OPENROUTER_API_KEY.get_secret_value(),
                     base_url="https://openrouter.ai/api/v1", temperature=0.7,
                     extra_body={"provider": {"require_parameters": True}, "max_tokens": 4000})
    with ThreadPoolExecutor(6) as pool:
        made = dict(zip(todo, pool.map(lambda n: make(llm, lessons[n]), todo)))
    for name, attempt in made.items():
        if attempt:
            attempts[name] = attempt
        print(f"{name:22} {'ok   ' + attempt['mistake'] if attempt else 'FAILED (no usable attempt; the test falls back to the returned answer)'}")
    ATTEMPTS.write_text(json.dumps(attempts, indent=1, sort_keys=True) + "\n")
    print(f"wrote {ATTEMPTS} ({len(attempts)} lessons)")


if __name__ == "__main__":
    main()
