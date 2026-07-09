"""
HTTP API routes for ExemplAI.

All FastAPI endpoints live here on an APIRouter; main.py only wires up the app
and includes this router. Route handlers stay thin — internal logic lives in
services.py, DB access in repository.py. (Graph edge-routing functions are a
separate concern — see ai/graph_router.py.)
"""

from fastapi import APIRouter, Request, Depends
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

from model.student_code import StudentCode
from model.chat import Chat
import services
from dependencies import get_current_user

# Shared with main.py for app.state + SlowAPIMiddleware wiring.
limiter = Limiter(key_func=get_remote_address)

router = APIRouter()


@router.get("/")
def read_root():
    return {"Hello": "World"}


@router.post('/execute')
@limiter.limit("10/minute")
async def judge0_execution(student_code: StudentCode, request: Request, current_user: dict = Depends(get_current_user)):
    return await services.execute_code(student_code)


@router.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}


@router.post("/chat")
async def chat(chat: Chat, request: Request, current_user: dict = Depends(get_current_user)):
    return await services.run_chat(request.app.state.tutor_graph, chat, current_user["id"])


@router.post("/chat/stream")
async def chat_stream(chat: Chat, request: Request, current_user: dict = Depends(get_current_user)):
    return StreamingResponse(
        services.stream_chat(request.app.state.tutor_graph, chat, current_user["id"]),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
