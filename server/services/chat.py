import asyncio
import time
import json
import logging
from typing import AsyncGenerator, NamedTuple, Optional
from fastapi import HTTPException, status
from convex import ConvexClient
from langchain_core.messages import RemoveMessage
from langgraph.graph.message import REMOVE_ALL_MESSAGES

from bkt import initial_mastery
from config import settings
from model.chat import Chat

log = logging.getLogger("rich")

# Centralized timeout constants
CONVEX_OP_TIMEOUT = 5.0


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
        # The Dean's one retry starts fresh on every request (state is checkpointed).
        "dean_retry": False,
        "dean_retried": False,
        "dean_feedback": "",
        "dean_reason": "",
    }


def example_limit_message(allowance: dict) -> str:
    """What the student is told when a typed request would exceed the allowance."""
    if allowance.get("exhausted"):
        return (
            f"You've used all {allowance.get('cap', 3)} examples for this lesson. Try a lesson "
            "on another topic, then come back here and you can get new examples again."
        )
    return (
        "You've used the examples you've earned so far. Submit another attempt "
        "to unlock your next example."
    )


def with_allowance(state: dict, allowance: Optional[dict]) -> dict:
    """Add the example allowance to the graph input (None: Convex predates it)."""
    if allowance is None:
        return state
    return {
        **state,
        "examples_remaining": allowance.get("remaining", 0),
        "example_limit_message": example_limit_message(allowance),
    }


class ChatLocked(Exception):
    """The lesson's chat isn't unlocked for this request (see check_chat_lock)."""


def check_chat_lock(chat: Chat, allowance: Optional[dict]) -> None:
    """Server-side copy of the Convex addMessage lock (web/convex/examples.ts),
    for the experimental group. The control group's plain chat isn't locked.

    Get help gives a round's first example and needs a failed Submit; New
    example needs Get help first and an example earned but not yet used; typed
    messages need the tutor to have replied once. Skipped when Convex predates
    the allowance.
    """
    if allowance is None or chat.experiment_condition == "control":
        return
    used, remaining = allowance.get("used", 0), allowance.get("remaining", 0)
    if chat.trigger == "get_help":
        if used > 0:
            raise ChatLocked("Get help has already been used; ask for a new example instead")
        if remaining < 1:
            raise ChatLocked("Get help unlocks after a failed Submit")
    elif chat.trigger == "new_example":
        if used < 1:
            raise ChatLocked("Use Get help first")
        if allowance.get("exhausted"):
            raise ChatLocked("All examples for this lesson are used; try another topic and come back")
        if remaining < 1:
            raise ChatLocked("Submit another attempt to unlock your next example")
    elif not allowance.get("helpStarted"):
        raise ChatLocked("Chat unlocks after Get help")


class ConvexChatContext(NamedTuple):
    history: Optional[list[dict]]   # None: Convex predates history in getChatContext
    allowance: Optional[dict]       # None: Convex predates the example allowance


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
                # The group stored in Convex (convex/experiment.ts); the browser's
                # value is ignored. Chats from before groups were stored have none.
                chat.experiment_condition = context.get("experiment_condition") or "experimental"
                if "error_trace" in context:
                    chat.error_trace = context["error_trace"] or ""
                return ConvexChatContext(context.get("messages"), context.get("example_allowance"))
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
    chosen_model: str,
    response_type: Optional[str] = None,
    dean_decision: Optional[str] = None,
    dean_reason: Optional[str] = None,
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
                        # What the reply delivered; Convex counts new examples.
                        **({"responseType": response_type} if response_type else {}),
                        # Why the reply is what it is (research log; see dean_validation).
                        **({"deanDecision": dean_decision} if dean_decision else {}),
                        **({"deanReason": dean_reason} if dean_reason else {}),
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
    started = time.perf_counter()
    try:
        client = _convex_client(auth_token)
        context = await _load_convex_context(client, chat)
        check_chat_lock(chat, context.allowance)

        allowance = None if chat.experiment_condition == "control" else context.allowance
        state = with_allowance(build_initial_state(chat, context.history), allowance)
        result = await graph.ainvoke(state, config=_thread_config(chat, auth_user_id))

        text = _extract_final_message_text(result)
        chosen_model = _determine_chosen_model(result)
        await _save_assistant_message(
            client, chat.chat_id, text, chosen_model, result.get("delivered_response_type"),
            dean_decision=result.get("dean_decision"), dean_reason=result.get("dean_reason"),
        )

        # Return a small, guaranteed-serializable payload rather than the raw
        # graph state (which carries LangChain message objects and can be large
        # or awkward to encode). The client renders the reply from Convex, not
        # from this body, so this only needs to confirm the run happened.
        log.info(f"chat total: {(time.perf_counter() - started) * 1000:.0f} ms (trigger={chat.trigger})")
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


# Graph steps reported to the chat UI as they finish (progress while waiting).
_PROGRESS_NODES = {
    "input_guardrail",
    "complete_example_node",
    "faded_example_node",
    "erroneous_example_node",
    "control_agent_node",
    "dean_validation_node",
}


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


async def stream_chat(graph, chat: Chat, auth_user_id: str, auth_token: str) -> AsyncGenerator[str, None]:
    """SSE generator. Sends a ``step`` event as each graph step finishes
    (guardrail, agent, Dean), so the UI can show real progress while the
    student waits. The Dean still validates the WHOLE draft before any text is
    released: the vetted reply is saved to Convex (which the UI renders) and
    then streamed as tokens, so no unvetted text reaches the student."""
    started = time.perf_counter()
    try:
        client = _convex_client(auth_token)
        context = await _load_convex_context(client, chat)
        check_chat_lock(chat, context.allowance)

        allowance = None if chat.experiment_condition == "control" else context.allowance
        state = with_allowance(build_initial_state(chat, context.history), allowance)
        config = _thread_config(chat, auth_user_id)
        async for update in graph.astream(state, config=config, stream_mode="updates"):
            for node in update:
                if node in _PROGRESS_NODES:
                    yield _sse({"type": "step", "node": node})
        result = (await graph.aget_state(config)).values
    except ChatLocked as e:
        yield _sse({"type": "error", "message": str(e)})
        return
    except Exception as e:
        log.error(f"AI service error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'message': 'AI service temporarily unavailable'})}\n\n"
        return

    text = _extract_final_message_text(result)
    chosen_model = _determine_chosen_model(result)
    try:
        await _save_assistant_message(
            client, chat.chat_id, text, chosen_model, result.get("delivered_response_type"),
            dean_decision=result.get("dean_decision"), dean_reason=result.get("dean_reason"),
        )
    except Exception as e:
        log.error(f"Message persistence error: {e}")
        yield f"data: {json.dumps({'type': 'error', 'message': 'Failed to save assistant message'})}\n\n"
        return

    # Re-chunk the vetted text into word tokens for progressive render.
    parts = text.split(" ")
    for i, part in enumerate(parts):
        token = part if i == 0 else " " + part
        yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

    log.info(f"chat total: {(time.perf_counter() - started) * 1000:.0f} ms (trigger={chat.trigger})")
    yield f"data: {json.dumps({'type': 'done'})}\n\n"
