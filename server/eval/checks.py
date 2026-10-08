"""Automatic checks on a tutor reply (no LLM judge).

- leak: some code block in the reply, renamed to the lesson's function, passes
  every one of the lesson's tests (visible and hidden): the reply gave away
  the answer. The most important check.
- syllabus: the code uses Python taught after the lesson's week
  (server/ai/syllabus.py), e.g. a loop in week 2 or a list before week 8.
- structure: a new example has code that parses (Faded blanks aside), Faded
  has blanks, and Complete / Erroneous code parses.
- student_code: the reply quotes a line of the student's code (the tutor must
  never work on the student's code).
"""

from __future__ import annotations

import ast
import difflib
import itertools
import re
import subprocess
import sys

from services import wrap_code_with_runner

from eval.cases import function_name

_BLOCK_RE = re.compile(r"```(?:python|py)?[ \t]*\n(.*?)```", re.DOTALL | re.IGNORECASE)
_BLANK_RE = re.compile(r"_{3,}")

WEEK = {"intro_setup": 1, "variables_expressions": 2, "strings_formatting": 3, "branching": 4, "loops": 5,
        "advanced_loops": 6, "functions": 7, "collections": 8, "files": 9, "basic_libraries": 11,
        "advanced_topics": 12}


def code_blocks(text: str) -> list[str]:
    return [b.strip("\n") for b in _BLOCK_RE.findall(text or "")]


def _parses(code: str) -> bool:
    try:
        ast.parse(code)
        return True
    except SyntaxError:
        return False


# A name fits a whole-line, value or condition blank; "+" fits an operator blank.
_FILLERS = ("_", "+")


def _without_blanks(code: str) -> str:
    """Faded code with each blank filled so it parses: a blank can be a whole line
    (`____`), a value or condition (`if ____:`), or an operator (`total ____ size`)."""
    parts = _BLANK_RE.split(code)
    blanks = len(parts) - 1
    options = itertools.product(_FILLERS, repeat=blanks) if blanks <= 6 else [("_",) * blanks]
    for fills in options:
        filled = "".join(p + f for p, f in zip(parts, fills)) + parts[-1]
        if _parses(filled):
            return filled
    return _BLANK_RE.sub("_", code)


def has_sample_call(code: str) -> bool:
    """Faded: the code ends with a call and its expected result, e.g. `print(f(3))  # 9`."""
    return any(re.match(r"^[A-Za-z_][\w.]*\(.*\)\s*#\s*\S", line) for line in code.splitlines())


def leak(lesson: dict, text: str) -> bool:
    """True if any function in the reply's code solves the lesson (passes all its tests)."""
    target = function_name(lesson)
    for block in code_blocks(text):
        if not _parses(block):
            continue
        names = [n.name for n in ast.walk(ast.parse(block)) if isinstance(n, ast.FunctionDef)]
        for name in names:
            program = block + f"\n{target} = {name}\n"
            runner = wrap_code_with_runner(program, lesson["starter_code"], lesson["solution_code"])
            solution = wrap_code_with_runner(lesson["solution_code"], lesson["starter_code"], lesson["solution_code"])
            ok = True
            for tc in lesson["testCases"]:
                try:
                    got = subprocess.run([sys.executable, "-c", runner], input=tc["input"], capture_output=True,
                                         text=True, timeout=5)
                except subprocess.TimeoutExpired:
                    ok = False
                    break
                exp = subprocess.run([sys.executable, "-c", solution], input=tc["input"], capture_output=True,
                                     text=True, timeout=5).stdout.strip()
                if got.returncode != 0 or got.stdout.strip() != exp:
                    ok = False
                    break
            if ok:
                return True
    return False


def _features(code: str) -> dict[str, int]:
    """Python features in the code -> the week they're taught."""
    found: dict[str, int] = {}
    tree = ast.parse(code)
    defs = 0
    for node in ast.walk(tree):
        if isinstance(node, (ast.If, ast.IfExp, ast.BoolOp)):
            found["if / and / or"] = 4
        elif isinstance(node, ast.Compare) and not all(isinstance(op, (ast.In, ast.NotIn)) for op in node.ops):
            found["comparison"] = 4
        elif isinstance(node, ast.Compare):
            found["in"] = 3
        elif isinstance(node, (ast.For, ast.While)):
            found["loop"] = 5
            if any(isinstance(inner, (ast.For, ast.While)) for inner in ast.walk(node) if inner is not node):
                found["nested loop"] = 6
        elif isinstance(node, (ast.Break, ast.Continue)):
            found["break / continue"] = 6
        elif isinstance(node, (ast.List, ast.Tuple, ast.Dict, ast.Set, ast.ListComp, ast.DictComp, ast.SetComp)):
            found["collection"] = 8
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            found["import"] = 11
        elif isinstance(node, ast.JoinedStr):
            found["f-string"] = 3
        elif isinstance(node, (ast.With,)):
            found["with / files"] = 9
        elif isinstance(node, ast.FunctionDef):
            defs += 1
            if node.args.defaults:
                found["default parameter"] = 7
        elif isinstance(node, ast.Subscript):
            found["indexing / slicing"] = 3
    if defs > 1:
        found["helper function"] = 7
    return found


def syllabus_violations(lesson: dict, text: str) -> list[str]:
    week = WEEK.get(lesson.get("knowledge_component", ""), 12)
    out = []
    for block in code_blocks(text):
        code = _without_blanks(block)
        if not _parses(code):
            continue
        out += [f"{name} (week {w})" for name, w in _features(code).items() if w > week]
    return sorted(set(out))


def structure_problems(text: str, mode: str, response_type: str | None) -> list[str]:
    """mode: complete | faded | erroneous | control."""
    problems = []
    blocks = code_blocks(text)
    if mode != "control" and response_type == "new_example":
        if not blocks:
            problems.append("no code block")
        elif mode == "faded" and not any(_BLANK_RE.search(b) for b in blocks):
            problems.append("faded without blanks")
        elif mode in ("complete", "erroneous") and not any(_parses(b) for b in blocks):
            problems.append("code doesn't parse")
        elif mode == "faded" and not any(_parses(_without_blanks(b)) for b in blocks):
            problems.append("code doesn't parse (blanks filled)")
    return problems


# Lines too generic to count as quoting the student (any example may contain them).
_GENERIC_LINE = re.compile(r"^(return\s+(True|False|None)|else:|pass|break|continue|try:|finally:)$")


def quotes_student_code(student_code: str, text: str) -> bool:
    lines = [l.strip() for l in student_code.splitlines()
             if len(l.strip()) >= 12 and not l.strip().startswith("def ") and not _GENERIC_LINE.match(l.strip())]
    return any(l in (text or "") for l in lines)


def similarity(a: str, b: str) -> float:
    """How alike two replies' code is (0-1), to check a New example really differs."""
    ca, cb = "\n".join(code_blocks(a)), "\n".join(code_blocks(b))
    if not ca or not cb:
        return 0.0
    return round(difflib.SequenceMatcher(None, ca, cb).ratio(), 2)
