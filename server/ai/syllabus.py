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

# (topic, week, features introduced) in teaching order; week 10 has no class
# (Christmas break). Week numbers follow the current COSC3104/5 schedule.
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
    ("functions", 7,
     "defining your own functions; parameters and default values; return values; "
     "calling one function from another"),
    ("collections", 8,
     "lists and list methods; indexing and slicing lists; tuples; dictionaries; sets; "
     "looping over collections; sorted(); list comprehensions"),
    ("files", 9, "open(), read, write; with blocks"),
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


# Logic bugs an Erroneous example may plant, per topic: the bug must exercise the
# lesson's own topic (not just loops), and stay within the allowed features.
TOPIC_BUGS: dict[str, str] = {
    "intro_setup": "printing a value instead of returning it; a wrong or misspelled string literal",
    "variables_expressions": "/ instead of // (or the reverse); % where // is needed (or the reverse); "
    "operator precedence (missing brackets); converting to int too early so the value is truncated; "
    "an off-by-one in a formula (e.g. rounding up when dividing)",
    "strings_formatting": "an off-by-one index or slice (e.g. s[1:] vs s[:-1]); concatenating in the "
    "wrong order; comparing without matching case (missing lower()); using the wrong string method",
    "branching": "> instead of >= (or < vs <=) at a boundary; and instead of or (or the reverse); "
    "conditions in the wrong order so a later branch never runs; a missing case",
    "loops": "an off-by-one range (e.g. range(n) vs range(1, n + 1)); the accumulator starting at the "
    "wrong value or not being updated; returning inside the loop too early; a while condition that "
    "stops one step early",
    "advanced_loops": "the inner loop using the outer loop's variable; break or continue in the wrong "
    "place; a counter or flag not reset for each outer iteration",
    "functions": "printing instead of returning; a missing return on one path; arguments passed in "
    "the wrong order; using a fixed value instead of the parameter",
    "collections": "an off-by-one list index; changing a list while looping over it; mixing up an "
    "index and a value; a wrong dictionary key or a missing key check",
    "files": "not stripping newlines; opening in write mode instead of append; reading the file twice",
    "basic_libraries": "calling a library function with arguments in the wrong order or units (e.g. "
    "degrees vs radians); expecting an int where the function returns a float",
    "advanced_topics": "a logic error in the topic's main idea",
}


def topic_bugs(knowledge_component: Optional[str]) -> str:
    """Bug types an Erroneous example may use for this topic ('' if unknown)."""
    return TOPIC_BUGS.get(knowledge_component or "", "")
