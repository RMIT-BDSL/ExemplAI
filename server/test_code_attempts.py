"""Research log: what the server sends for each Run / Submit (codeAttempts)."""

import asyncio
import os

os.environ.setdefault("OPENAI_API_KEY", "test")  # services imports the chat graph

import pytest
from fastapi import BackgroundTasks

import services
from model.student_code import StudentCode
from model.student_code import TestCase as LessonTestCase
from services import build_attempt, error_kind, submit_outcome


@pytest.mark.parametrize(
    "status_id, stderr, expected",
    [
        (3, "", None),
        (4, "", None),  # wrong answer is decided by the caller, not the trace
        (11, 'File "main.py", line 2\n    return\nSyntaxError: invalid syntax', "syntax_error"),
        (11, "IndentationError: expected an indented block", "syntax_error"),
        (6, "", "syntax_error"),
        (5, "", "timeout"),
        (11, "ZeroDivisionError: division by zero", "runtime_error"),
        (500, "Execution Service Error", "service_error"),
        (13, "", "service_error"),
    ],
)
def test_error_kind(status_id, stderr, expected):
    assert error_kind(status_id, stderr) == expected


def _result(passed, status_id=3, stderr="", hidden=False):
    return {"passed": passed, "status_id": status_id, "stderr": stderr, "hidden": hidden}


def test_submit_outcome_picks_the_most_basic_failure():
    assert submit_outcome([_result(True), _result(True)]) == "passed"
    assert submit_outcome([_result(True), _result(False, 4)]) == "wrong_answer"
    # A crash on one input outranks a wrong answer on another.
    assert submit_outcome([_result(False, 4), _result(False, 11, "TypeError: x")]) == "runtime_error"
    assert submit_outcome([_result(False, 11, "SyntaxError: bad")] * 3) == "syntax_error"
    assert submit_outcome([_result(False, 5), _result(False, 4)]) == "timeout"


def test_build_attempt_counts_hidden_tests_and_caps_code():
    results = [_result(True), _result(False, 4), _result(False, 4, hidden=True), _result(True, hidden=True)]
    attempt = build_attempt("x" * 30000, "wrong_answer", results, "e" * 5000)
    assert attempt["testsPassed"] == 2
    assert attempt["testsTotal"] == 4
    assert attempt["hiddenFailed"] == 1
    assert len(attempt["code"]) == 20000
    assert len(attempt["errorMessage"]) == 2000
    assert attempt["appVersion"] == "local"


def test_app_version_is_the_short_commit(monkeypatch):
    monkeypatch.setattr(services.settings, "RAILWAY_GIT_COMMIT_SHA", "d64a6ac1234567890")
    assert build_attempt("", "ran")["appVersion"] == "d64a6ac"


def _attempt_from(tasks: BackgroundTasks) -> dict:
    (task,) = tasks.tasks
    assert task.func is services._record_code_execution
    return task.args[5]


def test_run_logs_its_code_and_outcome(monkeypatch):
    async def fake_submit(code, language_id, stdin=None, **_):
        return {"status": {"id": 11}, "stdout": "", "stderr": "NameError: name 'y' is not defined"}

    monkeypatch.setattr(services, "_judge0_submit", fake_submit)
    monkeypatch.setattr(services.settings, "JUDGE0_ENDPOINT", "http://judge0.invalid")
    body = StudentCode(code="def f(x):\n    return y\n", starter_code="def f(x):\n    pass",
                       test_cases=[LessonTestCase(input="1", expectedOutput="1")], action_type="run")
    tasks = BackgroundTasks()
    asyncio.run(services.execute_code(body, tasks))

    attempt = _attempt_from(tasks)
    assert attempt["code"] == body.code
    assert attempt["outcome"] == "runtime_error"
    assert "NameError" in attempt["errorMessage"]
    assert "testsTotal" not in attempt  # Runs aren't graded


def test_submit_logs_counts_without_hidden_details(monkeypatch):
    async def fake_case(client, code, language_id, tc, exec_url, headers, expected=None):
        passed = tc.input != "-1"
        return {"passed": passed, "error": not passed, "stdout": "1" if passed else "0", "stderr": "",
                "status_id": 3 if passed else 4, "description": "", "input": tc.input,
                "expected": tc.expectedOutput, "hidden": tc.hidden, "test_description": None}

    monkeypatch.setattr(services, "run_single_test_case", fake_case)
    monkeypatch.setattr(services.settings, "JUDGE0_ENDPOINT", "http://judge0.invalid")
    body = StudentCode(
        code="def f(x):\n    return 1\n", starter_code="def f(x):\n    pass", action_type="submit",
        test_cases=[LessonTestCase(input="1", expectedOutput="1"),
                    LessonTestCase(input="-1", expectedOutput="", hidden=True)],
    )
    tasks = BackgroundTasks()
    asyncio.run(services.execute_code(body, tasks))

    attempt = _attempt_from(tasks)
    assert attempt["outcome"] == "wrong_answer"
    assert (attempt["testsPassed"], attempt["testsTotal"], attempt["hiddenFailed"]) == (1, 2, 1)
    assert "-1" not in attempt["errorMessage"]  # the hidden input is never logged
    assert "hidden test" in attempt["errorMessage"]


def test_attempt_reaches_convex(monkeypatch):
    sent = {}

    class FakeClient:
        def query(self, name, args):
            return None

        def mutation(self, name, args):
            sent.update(name=name, args=args)

    monkeypatch.setattr(services, "_convex_client", lambda token: FakeClient())
    monkeypatch.setattr(services.settings, "CONVEX_URL", "https://convex.invalid")
    attempt = build_attempt("print(1)", "ran")
    asyncio.run(services._record_code_execution("t", "lesson1", "run", True, None, attempt))

    assert sent["name"] == "courses:recordCodeExecution"
    assert sent["args"]["attempt"] == attempt
