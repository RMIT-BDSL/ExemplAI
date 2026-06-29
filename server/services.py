"""
Internal service functions — the logic the routes run.

Routes in routers.py stay thin (HTTP wiring only) and delegate to these. DB
access belongs in repository.py, not here.
"""

import os
import json
import logging
from typing import AsyncGenerator

import httpx
from fastapi import HTTPException, status
from sentry_sdk import metrics

from model.student_code import StudentCode
from model.chat import Chat
from ai.graph import graph

log = logging.getLogger("rich")

# todo: allow easy update of the following
is_rapidapi = os.getenv("IS_RAPIDAPI") == "True"


async def execute_code(student_code: StudentCode) -> dict:
    """Proxy a code submission to Judge0 and return its result."""
    # count to sentry for analytics
    metrics.count("code.execution", 1)
    # send the code to judge0
    endpoint = os.getenv('JUDGE0_ENDPOINT')
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JUDGE0_ENDPOINT environment variable is not configured."
        )
    exec_url = endpoint.rstrip('/') + '/submissions?base64_encoded=false&wait=true'

    # beautifully format the request payload
    payload = {
        'source_code': student_code.code,
        'language_id': 71, # python
    }
    # setup headers if auth key is provided
    headers = {}
    auth_key = os.getenv('JUDGE0_AUTH_KEY')
    if auth_key and not is_rapidapi:
        headers['X-Auth-Token'] = auth_key

    # support for rapidapi and that both string is not empty
    is_rapidapiconfig_valid = os.getenv('RAPIDAPI_KEY', '').strip() and os.getenv('RAPIDAPI_HOST', '').strip()
    if is_rapidapi and is_rapidapiconfig_valid:
        headers['X-RapidAPI-Key'] = os.getenv('RAPIDAPI_KEY', '')
        # Clean protocol scheme from Host if present (e.g. 'https://host' -> 'host')
        host = os.getenv('RAPIDAPI_HOST', '')
        if "://" in host:
            host = host.split("://")[-1]
        headers['X-RapidAPI-Host'] = host

    # make async request with httpx and timeout
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(exec_url, json=payload, headers=headers, timeout=15.0)
            response.raise_for_status()
            output = response.json()
            log.info(output)
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


def build_initial_state(chat: Chat) -> dict:
    """Map a /chat request into the TutorGraphState input dict."""
    # Map the conversation messages to LangGraph role and content structure
    langgraph_messages = []
    for msg in chat.conversation:
        role = "user" if msg.get("sender") == "user" else "assistant"
        langgraph_messages.append({"role": role, "content": msg.get("content", "")})

    # Fallback to a default greeting if conversation is empty
    if not langgraph_messages:
        langgraph_messages = [{"role": "user", "content": "hi!"}]

    return {
        "messages": langgraph_messages,
        "experiment_condition": chat.experiment_condition,
        "bkt_prob_mastery": chat.bkt_prob_mastery,
        "original_problem": chat.original_problem,
        "unit_test_assertions": chat.unit_test_assertions,
        "current_knowledge_component": chat.current_knowledge_component,
        "student_code": chat.student_code,
        "error_trace": chat.error_trace,
    }


def run_chat(chat: Chat) -> dict:
    """Run the tutor graph to completion and return the final state."""
    try:
        return graph.invoke(build_initial_state(chat))
    except Exception as e:
        log.error(f"AI service error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service temporarily unavailable"
        )


async def stream_chat(chat: Chat) -> AsyncGenerator[str, None]:
    """SSE generator. The Dean validates the WHOLE draft before any token is
    released, so the graph runs to completion first; we then stream the vetted
    final message token-by-token. This preserves the research-integrity gate
    (no unvetted text reaches the student) at the cost of no latency gain."""
    try:
        result = await graph.ainvoke(build_initial_state(chat))
    except Exception as e:
        log.error(f"AI service error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'message': 'AI service temporarily unavailable'})}\n\n"
        return

    # Dean-vetted final message (the only student-facing content).
    final = result["messages"][-1]
    text = getattr(final, "content", None)
    if text is None and isinstance(final, dict):
        text = final.get("content", "")
    text = text or ""

    # Re-chunk the vetted text into word tokens for progressive render.
    parts = text.split(" ")
    for i, part in enumerate(parts):
        token = part if i == 0 else " " + part
        yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"
