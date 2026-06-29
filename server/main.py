import os
from fastapi import FastAPI
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

app.include_router(router)
