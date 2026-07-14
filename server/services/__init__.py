"""
Internal service functions — the logic the routes run.

Routes in routers.py stay thin (HTTP wiring only) and delegate to these. DB
access belongs in repository.py, not here. The compiled tutor graph is created
at startup (bound to the Postgres checkpointer) and passed in from the route
handlers via app.state.
"""

import ast
import asyncio
import json
import logging
from typing import Optional

import httpx
from convex import ConvexClient
from fastapi import HTTPException, status, BackgroundTasks
from sentry_sdk import metrics

from bkt import initial_mastery, update_mastery
from config import settings
from model.student_code import StudentCode

log = logging.getLogger("rich")

# Centralized timeout constants
CONVEX_OP_TIMEOUT = 5.0


def _convex_client(auth_token: str) -> ConvexClient:
    client = ConvexClient(settings.CONVEX_URL)
    client.set_auth(auth_token)
    return client


async def _record_code_execution(
    auth_token: Optional[str],
    lesson_id: Optional[str],
    action_type: str,
    passed: bool,
) -> None:
    """After Judge0: set has_run; on first Submit compute BKT in Python and store."""
    if not auth_token or not lesson_id or not settings.CONVEX_URL:
        return

    action = action_type if action_type in ("run", "submit") else "run"
    mutation_args: dict = {
        "lessonId": lesson_id,
        "passed": passed,
        "actionType": action,
    }

    try:
        client = _convex_client(auth_token)

        if action == "submit":
            ctx = await asyncio.wait_for(
                asyncio.to_thread(
                    client.query,
                    "courses:getExecutionBktContext",
                    {"lessonId": lesson_id},
                ),
                timeout=CONVEX_OP_TIMEOUT,
            )
            if (
                ctx
                and not ctx.get("bkt_recorded")
                and ctx.get("knowledge_component")
            ):
                kc = ctx["knowledge_component"]
                current = ctx.get("prob_mastery")
                if current is None:
                    current = initial_mastery(kc)
                new_mastery = update_mastery(current, passed, kc)
                mutation_args["probMastery"] = new_mastery
                mutation_args["knowledgeComponent"] = kc

        await asyncio.wait_for(
            asyncio.to_thread(
                client.mutation,
                "courses:recordCodeExecution",
                mutation_args,
            ),
            timeout=CONVEX_OP_TIMEOUT,
        )
    except Exception as e:
        log.warning("execute — failed to record progress/BKT in Convex: %s", e)


# ── Code execution (Judge0) ───────────────────────────────────────────

def wrap_code_with_runner(student_code: str, starter_code: Optional[str], solution_code: Optional[str]) -> str:
    func_name = None
    func_args = []

    # Parse function name from starter_code, fallback to solution_code, fallback to student_code
    for code in [starter_code, solution_code, student_code]:
        if not code:
            continue
        try:
            tree = ast.parse(code)
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    func_name = node.name
                    func_args = [a.arg for a in node.args.args]
                    break
            if func_name:
                break
        except Exception:
            pass

    if not func_name:
        return student_code

    wrapper = f"""
# --- AUTO-GENERATED TEST RUNNER ---
if __name__ == "__main__":
    import sys
    import json

    input_data = sys.stdin.read().strip()

    args = []
    if input_data:
        try:
            if input_data.startswith('[') and input_data.endswith(']'):
                args = json.loads(input_data)
                if not isinstance(args, list):
                    args = [args]
            else:
                args = json.loads("[" + input_data + "]")
        except Exception:
            tokens = input_data.split()
            args = []
            for token in tokens:
                try:
                    if '.' in token:
                        args.append(float(token))
                    else:
                        args.append(int(token))
                except ValueError:
                    args.append(token)

    try:
        res = {func_name}(*args[:{len(func_args)}])
        if res is not None:
            if isinstance(res, (list, dict, set)):
                print(json.dumps(res))
            else:
                print(res)
    except Exception as e:
        print(f"Error executing function: {{e}}", file=sys.stderr)
        sys.exit(1)
"""
    return student_code + "\n" + wrapper


async def run_single_test_case(client, code, language_id, test_case, exec_url, headers, expected_output_from_sol=None):
    payload = {
        'source_code': code,
        'language_id': language_id,
        'stdin': test_case.input,
        'cpu_time_limit': 5.0,
        'wall_time_limit': 10.0,
    }
    try:
        response = await client.post(exec_url, json=payload, headers=headers, timeout=15.0)
        response.raise_for_status()
        result = response.json()
    except Exception as e:
        return {
            "passed": False,
            "error": True,
            "stdout": "",
            "stderr": f"Execution Service Error: {e}",
            "status_id": 500,
            "description": "Grader Service Connection Error",
            "input": test_case.input,
            "expected": test_case.expectedOutput,
            "hidden": test_case.hidden,
            "test_description": test_case.description
        }

    status_id = result.get("status", {}).get("id")
    stdout = result.get("stdout") or ""
    stderr = result.get("stderr") or ""
    compile_output = result.get("compile_output") or ""

    passed = False
    feedback = ""

    expected = expected_output_from_sol if expected_output_from_sol is not None else test_case.expectedOutput

    if status_id == 3:  # Accepted by judge0
        actual = stdout.strip()
        expected_clean = expected.strip()
        if actual == expected_clean:
            passed = True
        else:
            passed = False
            feedback = f"Wrong Answer. Expected: '{expected_clean}', Got: '{actual}'"
    else:
        passed = False
        feedback = result.get("status", {}).get("description") or "Execution Error"

    return {
        "passed": passed,
        "error": not passed,
        "stdout": stdout,
        "stderr": stderr or compile_output,
        "status_id": status_id if passed else (4 if status_id == 3 else status_id),
        "description": "Accepted" if passed else feedback,
        "input": test_case.input,
        "expected": expected,
        "hidden": test_case.hidden,
        "test_description": test_case.description
    }


async def execute_code(
    student_code: StudentCode,
    background_tasks: BackgroundTasks,
    auth_token: Optional[str] = None,
) -> dict:
    """Proxy a code submission to Judge0 and return a Pass/Fail result.

    When test_cases are provided, runs each case (optionally computing expected
    outputs from solution_code) and returns aggregate results; otherwise falls
    back to a single execution.

    After Judge0 completes, records has_run (and first-submit BKT) in Convex
    when lesson_id is present.
    """
    metrics.count("code.execution", 1)
    endpoint = settings.JUDGE0_ENDPOINT
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JUDGE0_ENDPOINT environment variable is not configured."
        )
    exec_url = endpoint.rstrip('/') + '/submissions?base64_encoded=false&wait=true'

    headers = {}
    auth_key = settings.JUDGE0_AUTH_KEY.get_secret_value()
    if auth_key and not settings.IS_RAPIDAPI:
        headers['X-Auth-Token'] = auth_key

    is_rapidapiconfig_valid = settings.RAPIDAPI_KEY.get_secret_value().strip() and settings.RAPIDAPI_HOST.strip()
    if settings.IS_RAPIDAPI and is_rapidapiconfig_valid:
        headers['X-RapidAPI-Key'] = settings.RAPIDAPI_KEY.get_secret_value()
        host = settings.RAPIDAPI_HOST
        if "://" in host:
            host = host.split("://")[-1]
        headers['X-RapidAPI-Host'] = host

    language_id = student_code.language_id or 71
    action_type = student_code.action_type or "run"
    lesson_id = student_code.lesson_id

    # Check if test cases are provided
    if student_code.test_cases:
        # Run reference solution in parallel to generate dynamic expected outputs if solution_code is present
        expected_outputs = {}
        if student_code.solution_code:
            sol_wrapped = wrap_code_with_runner(
                student_code.solution_code,
                student_code.starter_code,
                student_code.solution_code
            )
            async with httpx.AsyncClient() as client:
                sol_tasks = []
                for idx, tc in enumerate(student_code.test_cases):
                    payload = {
                        'source_code': sol_wrapped,
                        'language_id': language_id,
                        'stdin': tc.input,
                        'cpu_time_limit': 5.0,
                        'wall_time_limit': 10.0,
                    }
                    sol_tasks.append(client.post(exec_url, json=payload, headers=headers, timeout=15.0))

                sol_responses = await asyncio.gather(*sol_tasks, return_exceptions=True)

                for idx, resp in enumerate(sol_responses):
                    if isinstance(resp, Exception) or resp.status_code >= 400:
                        expected_outputs[idx] = student_code.test_cases[idx].expectedOutput
                    else:
                        res_data = resp.json()
                        if res_data.get("status", {}).get("id") == 3:
                            expected_outputs[idx] = (res_data.get("stdout") or "").strip()
                        else:
                            expected_outputs[idx] = student_code.test_cases[idx].expectedOutput
        else:
            for idx, tc in enumerate(student_code.test_cases):
                expected_outputs[idx] = tc.expectedOutput

        # Wrap student code
        student_wrapped = wrap_code_with_runner(
            student_code.code,
            student_code.starter_code,
            student_code.solution_code
        )

        # Run student code against all test cases
        async with httpx.AsyncClient() as client:
            student_tasks = [
                run_single_test_case(
                    client,
                    student_wrapped,
                    language_id,
                    tc,
                    exec_url,
                    headers,
                    expected_outputs[idx]
                )
                for idx, tc in enumerate(student_code.test_cases)
            ]
            results = await asyncio.gather(*student_tasks)

        # Sanitize results for the student
        sanitized_results = []
        for r in results:
            if r.get("hidden"):
                sanitized_r = {
                    "passed": r["passed"],
                    "error": r["error"],
                    "status_id": r["status_id"],
                    "description": "Hidden Test Failed" if not r["passed"] else "Accepted",
                    "hidden": True,
                    "test_description": r.get("test_description"),
                    "input": None,
                    "expected": None,
                    "stdout": None,
                    "stderr": None,
                }
                sanitized_results.append(sanitized_r)
            else:
                sanitized_results.append(r)

        # Analyze results
        failed_tests = [r for r in results if not r["passed"]]
        if failed_tests:
            first_fail = failed_tests[0]
            if first_fail.get("hidden"):
                fail_msg = "A hidden test case failed."
                result = {
                    "error": True,
                    "status": {
                        "id": first_fail["status_id"],
                        "description": "Hidden Test Failed"
                    },
                    "stdout": None,
                    "stderr": fail_msg,
                    "test_results": sanitized_results
                }
            else:
                fail_msg = (
                    f"Test Case Failed!\n"
                    f"Input: {first_fail['input']}\n"
                    f"Expected: {first_fail['expected']}\n"
                    f"Got: {first_fail['stdout'].strip()}\n"
                )
                if first_fail["stderr"]:
                    fail_msg += f"\nError: {first_fail['stderr']}\n"

                result = {
                    "error": True,
                    "status": {
                        "id": first_fail["status_id"],
                        "description": first_fail["description"]
                    },
                    "stdout": first_fail["stdout"],
                    "stderr": fail_msg,
                    "test_results": sanitized_results
                }
        else:
            result = {
                "error": False,
                "status": {
                    "id": 3,
                    "description": "Accepted"
                },
                "stdout": "All test cases passed successfully!\n",
                "stderr": None,
                "test_results": sanitized_results
            }

        background_tasks.add_task(
            _record_code_execution,
            auth_token,
            lesson_id,
            action_type,
            not result["error"]
        )
        return result

    # Fallback to single execution if no test cases are provided
    payload = {
        'source_code': student_code.code,
        'language_id': language_id,
        'cpu_time_limit': 5.0,
        'wall_time_limit': 10.0,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(exec_url, json=payload, headers=headers, timeout=15.0)
            response.raise_for_status()
            output = response.json()
            # Judge0 status id 3 = Accepted
            passed = (output.get("status") or {}).get("id") == 3
            background_tasks.add_task(
                _record_code_execution,
                auth_token,
                lesson_id,
                action_type,
                passed
            )
            return output
    except httpx.TimeoutException as e:
        log.error(f"Judge0 request timed out: {e}")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Code execution request timed out."
        )
    except httpx.HTTPStatusError as e:
        log.error(f"Judge0 error response {e.response.status_code}: {e.response.text}")
        try:
            err_data = e.response.json()
            detail = err_data.get("message") or err_data.get("error") or str(e)
        except Exception:
            detail = f"Execution service returned error: {e.response.text}"
        raise HTTPException(
            status_code=e.response.status_code,
            detail=detail
        )
    except httpx.RequestError as e:
        log.error(f"Judge0 connection error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to connect to the code execution service."
        )


# Import chat functions to expose them on the services module
from .chat import run_chat, stream_chat
