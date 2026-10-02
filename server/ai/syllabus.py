"""
COSC3104/5 syllabus: which Python features each topic introduces.

Examples must stay within what the student has been taught: a lesson's allowed
features are those of its topic and every earlier topic (TODO.md: "Don't want
students to learn something more difficult than what's been covered").

Keys match data/bktParams.json and the lessons' knowledge_component. The
syllabus only gives week titles, so the feature lists are the research team's
reading of them — review them against the course guide.
"""

from __future__ import annotations

from typing import Optional

# (topic, week, features introduced) in teaching order; week 7 has no class.
SYLLABUS: list[tuple[str, int, str]] = [
    ("intro_setup", 1, "print(); string and number literals; comments"),
    ("variables_expressions", 2,
     "variables and assignment; int, float, str, bool; arithmetic + - * / // % **; "
     "int(), float(), str(), round(); input()"),
    ("strings_formatting", 3,
     "string indexing and slicing; len(); concatenation and repetition; string methods "
     "such as upper(), lower(), strip(), replace(), find(); the in operator on strings; "
     "f-strings"),
    ("branching", 4, "comparisons; and, or, not; if / elif / else; nested if"),
    ("loops", 5, "for loops with range(); for over a string; while loops; the accumulator pattern"),
    ("advanced_loops", 6, "nested loops; break and continue; loop flags and counters"),
    ("functions", 8,
     "defining your own functions; parameters and default values; return values; "
     "calling one function from another"),
    ("collections", 9,
     "lists and list methods; indexing and slicing lists; tuples; dictionaries; sets; "
     "looping over collections; sorted(); list comprehensions"),
    ("files", 10, "open(), read, write; with blocks"),
    ("basic_libraries", 11, "import; standard-library modules such as math, random, string, datetime"),
    ("advanced_topics", 12, "any Python feature"),
]

# Every lesson is a "write a function" exercise, so this shape is allowed from week 1.
LESSON_FUNCTION_SHAPE = (
    "a function definition in the same form as the lesson's starter code "
    "(def name(parameters): ... return ...)"
)


def allowed_python(knowledge_component: Optional[str]) -> str:
    """The Python features allowed in examples for a lesson's topic.

    Empty string for an unknown or missing topic (no restriction is given).
    """
    topics = [t for t, _, _ in SYLLABUS]
    if knowledge_component not in topics:
        return ""
    upto = topics.index(knowledge_component) + 1
    lines = [f"- {LESSON_FUNCTION_SHAPE}"]
    lines += [f"- {features} (week {week})" for _, week, features in SYLLABUS[:upto]]
    return "\n".join(lines)
