import asyncio
import sys
from contextlib import asynccontextmanager

# psycopg's async driver (used by the LangGraph checkpointer pool) cannot run on
# Windows' default ProactorEventLoop — it requires a SelectorEventLoop. Set the
# policy before the event loop is created (i.e. before uvicorn starts serving).
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# logging with rich
import logging
from rich.logging import RichHandler

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from config import settings, log_config_summary
from routers import router, limiter
from ai.graph import build_tutor_graph
from ai.checkpointer import open_checkpointer


sentry_sdk.init(
    dsn=settings.SENTRY_DSN.get_secret_value() or None,
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

# Log which integrations are configured (booleans only — never secret values).
log_config_summary()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Bind the tutor graph to the Postgres checkpointer for multi-turn memory.

    Fail fast: if the checkpointer can't open, startup aborts. A graph without
    persistence would silently lose session state and corrupt the multi-turn
    EBL/BKT sequencing the RCT depends on.
    """
    pool, saver = await open_checkpointer()
    app.state.db_pool = pool
    app.state.tutor_graph = build_tutor_graph().compile(checkpointer=saver)
    log.info("tutor graph compiled with Postgres checkpointer")
    try:
        yield
    finally:
        await app.state.db_pool.close()
        log.info("checkpointer pool closed")


app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:5173"
    ], # In production, add your production frontend origin here
    allow_origin_regex=".*", # Allows all origins (useful for Cloudflare tunnels/Railway)
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods, including POST and OPTIONS
    allow_headers=["*"], # Allows all headers
)

app.include_router(router)