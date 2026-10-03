"""Run mode (UX update): run the file, call the function once on the example,
report prints / return value / traceback separately, and never feed stdin."""

import asyncio
import os
import subprocess
import sys

os.environ.setdefault("OPENAI_API_KEY", "test")  # services imports the chat graph

import pytest
from fastapi import BackgroundTasks

import services
from model.student_code import StudentCode
from model.student_code import TestCase as LessonTestCase
from services import (
    RUN_RETURN_SENTINEL,
    build_run_program,
    parse_test_input,
    split_run_stdout,
)


def run_python(program: str) -> subprocess.CompletedProcess:
    """Execute like Judge0 does: a fresh interpreter, empty stdin."""
    return subprocess.run(
        [sys.executable, "-c", program],
        input="",
        capture_output=True,
        text=True,
        timeout=10,
    )


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("", []),
        ("5", [5]),
        ("2 3", [2, 3]),
        ("2.5", [2.5]),
        ('["hello"]', ["hello"]),
        ('[[1, 2]]', [[1, 2]]),
        ('"a", 3', ["a", 3]),
        ("abc def", ["abc", "def"]),
    ],
)
def test_parse_test_input_matches_runner(raw, expected):
    assert parse_test_input(raw) == expected


def test_prints_and_return_value_are_separated():
    code = "def raiseToPower(b, e):\n    print('computing', b, e)\n    return b ** e\n"
    program = build_run_program(code, "def raiseToPower(base, exponent):\n    pass", None, "2 3")
    proc = run_python(program)
    assert proc.returncode == 0, proc.stderr
    prints, value = split_run_stdout(proc.stdout)
    assert prints == "computing 2 3\n"
    assert value == "8"


def test_string_return_value_is_repr():
    program = build_run_program(
        "def helloWorld():\n    return 'Hello World!'\n", "def helloWorld():\n    pass", None, ""
    )
    _, value = split_run_stdout(run_python(program).stdout)
    assert value == "'Hello World!'"


def test_none_return_value_is_reported():
    program = build_run_program("def f(x):\n    pass\n", "def f(x):\n    pass", None, "1")
    _, value = split_run_stdout(run_python(program).stdout)
    assert value == "None"


def test_exception_gives_traceback_and_no_return_value():
    program = build_run_program("def f(x):\n    return 1 / 0\n", "def f(x):\n    pass", None, "1")
    proc = run_python(program)
    assert "ZeroDivisionError" in proc.stderr
    _, value = split_run_stdout(proc.stdout)
    assert value is None


def test_input_call_hits_eof_instead_of_reading_arguments():
    code = "def f(n):\n    n = int(input('Enter a number: '))\n    return n\n"
    program = build_run_program(code, "def f(n):\n    pass", None, "42")
    proc = run_python(program)
    assert "EOFError" in proc.stderr


def test_no_function_runs_file_as_written():
    program = build_run_program("print('hi')\n", None, None, "1")
    assert program == "print('hi')\n"
    assert run_python(program).stdout == "hi\n"


def test_split_without_sentinel_keeps_all_output():
    assert split_run_stdout("a\nb\n") == ("a\nb\n", None)
    assert split_run_stdout(None) == ("", None)


def test_sentinel_printed_by_student_does_not_confuse_split():
    # The last sentinel line wins, so a student echoing it can't fake a value.
    out = f"{RUN_RETURN_SENTINEL}\nfake\n{RUN_RETURN_SENTINEL}\n'real'\n"
    prints, value = split_run_stdout(out)
    assert value == "'real'"
    assert prints == f"{RUN_RETURN_SENTINEL}\nfake\n"


def test_execute_code_run_mode_does_one_ungraded_execution(monkeypatch):
    calls = []

    async def fake_submit(code, language_id, stdin=None, **_):
        calls.append({"code": code, "stdin": stdin})
        return {
            "status": {"id": 3, "description": "Accepted"},
            "stdout": f"hello\n{RUN_RETURN_SENTINEL}\n8\n",
            "stderr": None,
            "time": "0.038",
        }

    monkeypatch.setattr(services, "_judge0_submit", fake_submit)
    monkeypatch.setattr(services.settings, "JUDGE0_ENDPOINT", "http://judge0.invalid")
    body = StudentCode(
        code="def raiseToPower(b, e):\n    print('hello')\n    return b ** e\n",
        starter_code="def raiseToPower(base, exponent):\n    pass",
        solution_code="def raiseToPower(base, exponent):\n    return base ** exponent",
        test_cases=[LessonTestCase(input="2 3", expectedOutput="8")],
        action_type="run",
    )
    tasks = BackgroundTasks()
    result = asyncio.run(services.execute_code(body, tasks))

    assert len(calls) == 1  # no reference-solution runs, no per-test runs
    assert calls[0]["stdin"] is None
    assert result == {
        "mode": "run",
        "error": False,
        "status": {"id": 3, "description": "Accepted"},
        "stdout": "hello\n",
        "return_value": "8",
        "stderr": "",
        "time_ms": 38,
    }
    assert "test_results" not in result
    assert len(tasks.tasks) == 1  # has_run is still recorded
