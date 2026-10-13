"""Quick-check grading (services.submit_check; web/convex/quickChecks.ts)."""

import asyncio

import pytest
from fastapi import HTTPException

import services
from model.student_code import CheckSubmission


class FakeConvex:
    def __init__(self, info):
        self.info = info
        self.recorded = None

    def query(self, name, args):
        assert name == "quickChecks:getForGrading"
        assert "backendSecret" in args
        return self.info

    def mutation(self, name, args):
        assert name == "quickChecks:recordAnswer"
        self.recorded = args


def _patch(monkeypatch, convex, passes):
    monkeypatch.setattr(services, "_convex_client", lambda token: convex)
    monkeypatch.setattr(services, "_exec_url", lambda: "http://judge0")
    monkeypatch.setattr(services, "_judge0_headers", lambda: {})
    results = iter(passes)

    async def fake_test(client, code, language_id, tc, url, headers, expected=None):
        ok = next(results)
        return {"passed": ok, "status_id": 3 if ok else 4, "stderr": "", "hidden": True}

    monkeypatch.setattr(services, "run_single_test_case", fake_test)


INFO = {"starter_code": "def f(x):\n    pass", "tests": [{"input": str(i), "expectedOutput": "1"} for i in range(5)]}


def test_grades_against_convex_tests_and_records_the_score(monkeypatch):
    convex = FakeConvex(INFO)
    _patch(monkeypatch, convex, [True, True, False, True, False])
    out = asyncio.run(services.submit_check(CheckSubmission(check_id="p1", code="def f(x): return 1", auto=True), "t"))
    assert out == {"recorded": True}  # no score goes back to the student
    assert (convex.recorded["testsPassed"], convex.recorded["testsTotal"]) == (3, 5)
    assert convex.recorded["outcome"] == "wrong_answer"
    assert convex.recorded["auto"] is True


def test_refuses_when_the_answer_cant_be_accepted(monkeypatch):
    convex = FakeConvex(None)
    _patch(monkeypatch, convex, [])
    with pytest.raises(HTTPException) as e:
        asyncio.run(services.submit_check(CheckSubmission(check_id="p1", code="x"), "t"))
    assert e.value.status_code == 409
    assert convex.recorded is None


def test_grader_outage_records_nothing(monkeypatch):
    convex = FakeConvex(INFO)
    _patch(monkeypatch, convex, [True] * 5)

    async def broken(client, code, language_id, tc, url, headers, expected=None):
        return {"passed": False, "status_id": 500, "stderr": "down", "hidden": True}

    monkeypatch.setattr(services, "run_single_test_case", broken)
    with pytest.raises(HTTPException) as e:
        asyncio.run(services.submit_check(CheckSubmission(check_id="p1", code="x"), "t"))
    assert e.value.status_code == 502
    assert convex.recorded is None


def test_judge0_internal_error_records_nothing(monkeypatch):
    convex = FakeConvex(INFO)
    _patch(monkeypatch, convex, [True] * 5)

    async def internal_error(client, code, language_id, tc, url, headers, expected=None):
        return {"passed": False, "status_id": 13, "stderr": "", "hidden": True}

    monkeypatch.setattr(services, "run_single_test_case", internal_error)
    with pytest.raises(HTTPException) as e:
        asyncio.run(services.submit_check(CheckSubmission(check_id="p1", code="x"), "t"))
    assert e.value.status_code == 502
    assert convex.recorded is None
