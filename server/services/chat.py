import asyncio
import concurrent.futures
import json
import logging
from typing import AsyncGenerator, NamedTuple, Optional
from fastapi import HTTPException, status
from convex import ConvexClient
from langchain_core.messages import RemoveMessage
from langgraph.graph.message import REMOVE_ALL_MESSAGES
from posthog import Posthog

from bkt import initial_mastery
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


def build_initial_state(chat: Chat, history: Optional[list[dict]] = None) -> dict:
    """Map a /chat request into the TutorGraphState input dict.

    ``history`` is the lesson conversation from Convex (chats:getChatContext),
    oldest first and ending with the student's latest message. It is the
    source of truth: the browser-sent ``chat.conversation`` is only used if
    the Convex deployment predates history in getChatContext.

    The leading RemoveMessage(REMOVE_ALL_MESSAGES) replaces the checkpointed
    messages instead of appending to them; appending re-added the whole
    conversation every turn (2, 6, 12, ... messages).
    """
    if history is None:
        log.warning("chat history missing from Convex context; using browser conversation")
        history = chat.conversation

    langgraph_messages = []
    for msg in history:
        role = "user" if msg.get("sender") == "user" else "assistant"
        langgraph_messages.append({"role": role, "content": msg.get("content", "")})

    if not langgraph_messages:
        langgraph_messages = [{"role": "user", "content": "hi!"}]

    return {
        "messages": [RemoveMessage(id=REMOVE_ALL_MESSAGES), *langgraph_messages],
        "experiment_condition": chat.experiment_condition,
        "bkt_prob_mastery": chat.bkt_prob_mastery,
        "original_problem": chat.original_problem,
        "unit_test_assertions": chat.unit_test_assertions,
        "current_knowledge_component": chat.current_knowledge_component,
        "student_code": chat.student_code,
        "error_trace": chat.error_trace,
        "trigger": chat.trigger,
    }


class ChatLocked(Exception):
    """The lesson's chat isn't unlocked for this request (see check_chat_lock)."""


def check_chat_lock(chat: Chat, history: Optional[list[dict]], failed_submits: Optional[int]) -> None:
    """Server-side copy of the Convex addMessage lock.

    Get help needs a failed Submit and works once per lesson (before the
    tutor's first reply); typed messages need that first reply. Skipped when
    Convex predates the lock (no failed_submits / history in the context).
    """
    if failed_submits is None or history is None:
        return
    help_started = any(m.get("sender") == "assistant" for m in history)
    if chat.trigger == "get_help":
        if failed_submits < 1:
            raise ChatLocked("Get help unlocks after a failed Submit")
        if help_started:
            raise ChatLocked("Help has already started for this lesson")
    elif not help_started:
        raise ChatLocked("Chat unlocks after Get help")


_posthog_executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)

async def _evaluate_posthog_condition(auth_user_id: str, chat: Chat) -> None:
    if getattr(chat, "experiment_condition", None):
        return

    chat.experiment_condition = "control"

    if posthog_client:
        try:
            loop = asyncio.get_running_loop()
            flag = await asyncio.wait_for(
                loop.run_in_executor(
                    _posthog_executor,
                    posthog_client.get_feature_flag,
                    "new-model-test",
                    auth_user_id
                ),
                timeout=POSTHOG_FLAG_TIMEOUT
            )
            if flag == "prompted":
                chat.experiment_condition = "experimental"
        except Exception as e:
            log.warning("PostHog flag evaluation failed: %s", e)


class ConvexChatContext(NamedTuple):
    history: Optional[list[dict]]   # None: Convex predates history in getChatContext
    failed_submits: Optional[int]   # None: Convex predates the Get help lock


async def _load_convex_context(client: ConvexClient, chat: Chat) -> ConvexChatContext:
    """Fill ``chat`` with lesson/BKT/error context from Convex; return the
    conversation and failed-Submit count."""
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
                # No mastery row yet (no graded Submit on this KC) → cold-start P-Init.
                mastery = context.get("bkt_prob_mastery")
                if mastery is None:
                    mastery = initial_mastery(chat.current_knowledge_component or None)
                chat.bkt_prob_mastery = mastery
                if context.get("experiment_condition"):
                    chat.experiment_condition = context.get("experiment_condition")
                if "error_trace" in context:
                    chat.error_trace = context["error_trace"] or ""
                return ConvexChatContext(context.get("messages"), context.get("failed_submits"))
        except Exception as cvx_err:
            log.error(f"Failed to fetch chat context from Convex: {cvx_err}")
            raise RuntimeError("Unable to load authenticated chat context") from cvx_err
    return ConvexChatContext(None, None)


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
                    "chats:addSystemMessage",
                    {
                        "chatId": chat_id,
                        "sender": "assistant",
                        "content": text,
                        "sentBySystem": True,
                        "model": chosen_model,
                        "backendSecret": settings.CONVEX_BACKEND_SECRET.get_secret_value()
                    },
                ),
                timeout=CONVEX_OP_TIMEOUT,
            )
        except Exception as cvx_err:
            log.error(f"Failed to sync AI message to Convex: {cvx_err}")
            raise RuntimeError("Failed to persist assistant message") from cvx_err


async def run_chat(graph, chat: Chat, auth_user_id: str, auth_token: str) -> dict:
    """Run the tutor graph to completion and return the final state."""
    try:
        client = _convex_client(auth_token)
        context = await _load_convex_context(client, chat)
        check_chat_lock(chat, context.history, context.failed_submits)
        await _evaluate_posthog_condition(auth_user_id, chat)

        result = await graph.ainvoke(build_initial_state(chat, context.history), config=_thread_config(chat, auth_user_id))

        text = _extract_final_message_text(result)
        chosen_model = _determine_chosen_model(result)
        await _save_assistant_message(client, chat.chat_id, text, chosen_model)

        # Return a small, guaranteed-serializable payload rather than the raw
        # graph state (which carries LangChain message objects and can be large
        # or awkward to encode). The client renders the reply from Convex, not
        # from this body, so this only needs to confirm the run happened.
        return {
            "messages": [{"type": "ai", "content": text}],
            "chosen_model": chosen_model,
        }
    except ChatLocked as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
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
        context = await _load_convex_context(client, chat)
        check_chat_lock(chat, context.history, context.failed_submits)
        await _evaluate_posthog_condition(auth_user_id, chat)

        result = await graph.ainvoke(build_initial_state(chat, context.history), config=_thread_config(chat, auth_user_id))
    except ChatLocked as e:
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        return
    except Exception as e:
        log.error(f"AI service error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'message': 'AI service temporarily unavailable'})}\n\n"
        return

    text = _extract_final_message_text(result)
    chosen_model = _determine_chosen_model(result)
    try:
        await _save_assistant_message(client, chat.chat_id, text, chosen_model)
    except Exception as e:
        log.error(f"Message persistence error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'message': 'Failed to save assistant message'})}\n\n"
        return

    # Re-chunk the vetted text into word tokens for progressive render.
    parts = text.split(" ")
    for i, part in enumerate(parts):
        token = part if i == 0 else " " + part
        yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"
