import asyncio
import json
import logging
from typing import AsyncGenerator, Optional
from fastapi import HTTPException, status
from convex import ConvexClient
from posthog import Posthog

from config import settings
from model.chat import Chat

log = logging.getLogger("rich")

# Centralized timeout constants
POSTHOG_FLAG_TIMEOUT = 2.0
CONVEX_OP_TIMEOUT = 5.0

posthog_client = None
if settings.POSTHOG_PROJECT_TOKEN:
    try:
        posthog_client = Posthog(settings.POSTHOG_PROJECT_TOKEN, host=settings.POSTHOG_HOST)
    except Exception as e:
        log.warning(f"Failed to initialize PostHog: {e}")


def _convex_client(auth_token: str) -> ConvexClient:
    client = ConvexClient(settings.CONVEX_URL)
    client.set_auth(auth_token)
    return client


def _thread_config(chat: Chat, auth_user_id: str) -> dict:
    """LangGraph config scoping the checkpoint to this user + conversation."""
    return {"configurable": {"thread_id": f"exemplai:{auth_user_id}:{chat.chat_id}"}}


def build_initial_state(chat: Chat) -> dict:
    """Map a /chat request into the TutorGraphState input dict."""
    langgraph_messages = []
    for msg in chat.conversation:
        role = "user" if msg.get("sender") == "user" else "assistant"
        langgraph_messages.append({"role": role, "content": msg.get("content", "")})

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


async def _evaluate_posthog_condition(auth_user_id: str, chat: Chat) -> None:
    if posthog_client:
        try:
            flag = await asyncio.wait_for(
                asyncio.to_thread(
                    posthog_client.get_feature_flag,
                    "new-model-test",
                    auth_user_id
                ),
                timeout=POSTHOG_FLAG_TIMEOUT
            )
            if flag == "control":
                chat.experiment_condition = "experimental"
            elif flag == "prompted":
                chat.experiment_condition = "control"
            else:
                chat.experiment_condition = "experimental"
        except Exception as e:
            log.warning("PostHog flag evaluation failed: %s", e)


async def _load_convex_context(client: ConvexClient, chat: Chat) -> None:
    if chat.chat_id:
        try:
            context = await asyncio.wait_for(
                asyncio.to_thread(
                    client.query,
                    "chats:getChatContext",
                    {"chatId": chat.chat_id},
                ),
                timeout=CONVEX_OP_TIMEOUT,
            )
            if context:
                chat.original_problem = context.get("original_problem", "")
                chat.current_knowledge_component = context.get("current_knowledge_component", "")
                chat.bkt_prob_mastery = context.get("bkt_prob_mastery", 0.0)
        except Exception as cvx_err:
            log.error(f"Failed to fetch chat context from Convex: {cvx_err}")


def _determine_chosen_model(result: dict) -> str:
    if not result.get("guardrail_passed", True):
        return "guardrail_blocked"
    elif result.get("experiment_condition") == "control":
        return "control_agent_node"
    else:
        mastery = result.get("bkt_prob_mastery", 0.0)
        if mastery < 0.3:
            return "complete_example_node"
        elif mastery <= 0.7:
            return "faded_example_node"
        else:
            return "erroneous_example_node"


def _extract_final_message_text(result: dict) -> str:
    final = result["messages"][-1]
    text = getattr(final, "content", None)
    if text is None and isinstance(final, dict):
        text = final.get("content", "")
    return text or ""


async def _save_assistant_message(
    client: ConvexClient,
    chat_id: Optional[str],
    text: str,
    chosen_model: str
) -> None:
    if text and chat_id:
        try:
            await asyncio.wait_for(
                asyncio.to_thread(
                    client.mutation,
                    "chats:addMessage",
                    {
                        "chatId": chat_id,
                        "sender": "assistant",
                        "content": text,
                        "sentBySystem": True,
                        "model": chosen_model
                    },
                ),
                timeout=CONVEX_OP_TIMEOUT,
            )
        except Exception as cvx_err:
            log.error(f"Failed to sync AI message to Convex: {cvx_err}")


async def run_chat(graph, chat: Chat, auth_user_id: str, auth_token: str) -> dict:
    """Run the tutor graph to completion and return the final state."""
    try:
        client = _convex_client(auth_token)
        await _evaluate_posthog_condition(auth_user_id, chat)
        await _load_convex_context(client, chat)

        result = await graph.ainvoke(build_initial_state(chat), config=_thread_config(chat, auth_user_id))

        text = _extract_final_message_text(result)
        chosen_model = _determine_chosen_model(result)
        await _save_assistant_message(client, chat.chat_id, text, chosen_model)

        return result
    except Exception as e:
        log.error(f"AI service error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service temporarily unavailable"
        )


async def stream_chat(graph, chat: Chat, auth_user_id: str, auth_token: str) -> AsyncGenerator[str, None]:
    """SSE generator. The Dean validates the WHOLE draft before any token is
    released, so the graph runs to completion first; we then stream the vetted
    final message token-by-token. This preserves the research-integrity gate
    (no unvetted text reaches the student) at the cost of no latency gain."""
    try:
        client = _convex_client(auth_token)
        await _evaluate_posthog_condition(auth_user_id, chat)
        await _load_convex_context(client, chat)

        result = await graph.ainvoke(build_initial_state(chat), config=_thread_config(chat, auth_user_id))
    except Exception as e:
        log.error(f"AI service error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'message': 'AI service temporarily unavailable'})}\n\n"
        return

    text = _extract_final_message_text(result)
    chosen_model = _determine_chosen_model(result)
    await _save_assistant_message(client, chat.chat_id, text, chosen_model)

    # Re-chunk the vetted text into word tokens for progressive render.
    parts = text.split(" ")
    for i, part in enumerate(parts):
        token = part if i == 0 else " " + part
        yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"
