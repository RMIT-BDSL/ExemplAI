from typing import Optional
import os
import httpx
import ast
import asyncio
from model.student_code import StudentCode
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import sentry_sdk
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from model.chat import Chat
from ai.graph import graph

# logging with rich
import logging
from rich.logging import RichHandler

from routers import router, limiter

# load .env file (before anything reads env vars)
load_dotenv()


sentry_sdk.init(
    dsn=os.getenv('SENTRY_DSN'),
    # Add data like request headers and IP for users,
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
)

log = logging.getLogger("rich")
log.setLevel(logging.INFO)
log.handlers.clear()
handler = RichHandler(rich_tracebacks=True)
handler.setFormatter(logging.Formatter("%(message)s", datefmt="[%X]"))
log.addHandler(handler)
log.propagate = False


app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace "*" with your frontend origin (e.g., ["http://localhost:5173"])
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods, including POST and OPTIONS
    allow_headers=["*"], # Allows all headers
)




@app.get("/")
def read_root():
    return {"Hello": "World"}

# todo: allow easy update of the following
is_rapidapi = os.getenv("IS_RAPIDAPI") == "True"

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
    
    if status_id == 3: # Accepted by judge0
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


@app.post('/execute')
@limiter.limit("10/minute")
async def judge0_execution(student_code: StudentCode, request: Request):
    metrics.count("code.execution", 1)
    endpoint = os.getenv('JUDGE0_ENDPOINT')
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JUDGE0_ENDPOINT environment variable is not configured."
        )
    exec_url = endpoint.rstrip('/') + '/submissions?base64_encoded=false&wait=true'
    
    headers = {}
    auth_key = os.getenv('JUDGE0_AUTH_KEY')
    if auth_key and not is_rapidapi:
        headers['X-Auth-Token'] = auth_key

    is_rapidapiconfig_valid = os.getenv('RAPIDAPI_KEY', '').strip() and os.getenv('RAPIDAPI_HOST', '').strip()
    if is_rapidapi and is_rapidapiconfig_valid:
        headers['X-RapidAPI-Key'] = os.getenv('RAPIDAPI_KEY', '')
        host = os.getenv('RAPIDAPI_HOST', '')
        if "://" in host:
            host = host.split("://")[-1]
        headers['X-RapidAPI-Host'] = host
    
    language_id = student_code.language_id or 71

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
                    if isinstance(resp, Exception) or resp.status_code != 200:
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

        # Analyze results
        failed_tests = [r for r in results if not r["passed"]]
        if failed_tests:
            first_fail = failed_tests[0]
            fail_msg = (
                f"Test Case Failed!\n"
                f"Input: {first_fail['input']}\n"
                f"Expected: {first_fail['expected']}\n"
                f"Got: {first_fail['stdout'].strip()}\n"
            )
            if first_fail["stderr"]:
                fail_msg += f"\nError: {first_fail['stderr']}\n"

            return {
                "error": True,
                "status": {
                    "id": first_fail["status_id"],
                    "description": first_fail["description"]
                },
                "stdout": first_fail["stdout"],
                "stderr": fail_msg,
                "test_results": results
            }
        else:
            return {
                "error": False,
                "status": {
                    "id": 3,
                    "description": "Accepted"
                },
                "stdout": "All test cases passed successfully!\n",
                "stderr": None,
                "test_results": results
            }
    
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

@app.post("/chat")
def chat(chat: Chat):
    # Map the conversation messages to LangGraph role and content structure
    langgraph_messages = []
    for msg in chat.conversation:
        role = "user" if msg.get("sender") == "user" else "assistant"
        langgraph_messages.append({"role": role, "content": msg.get("content", "")})

    # Fallback to a default greeting if conversation is empty
    if not langgraph_messages:
        langgraph_messages = [{"role": "user", "content": "hi!"}]
    try:
        return graph.invoke({"messages": langgraph_messages})
    except Exception as e:
        log.error(f"AI service error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service temporarily unavailable"
        )
