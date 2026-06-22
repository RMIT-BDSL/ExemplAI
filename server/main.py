import os
import httpx
from model.student_code import StudentCode
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

# logging with rich
import logging
from rich.logging import RichHandler

log = logging.getLogger("rich")
log.setLevel(logging.INFO)
log.handlers.clear()
handler = RichHandler(rich_tracebacks=True)
handler.setFormatter(logging.Formatter("%(message)s", datefmt="[%X]"))
log.addHandler(handler)
log.propagate = False


# load .env file
load_dotenv()

limiter = Limiter(key_func=get_remote_address)
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

# send to url
# todo: prob need question id to do this, testing
# code execution for now
@app.post('/execute')
@limiter.limit("10/minute")
async def judge0_execution(student_code: StudentCode, request: Request):
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
    
    # support for rapidapi
    if is_rapidapi:
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


@app.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}