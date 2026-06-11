import requests
import os
from model.student_code import StudentCode
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

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

app = FastAPI()

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


# send to url
# todo: prob need question id to do this, testing
# code execution for now
@app.post('/execute')
def judge0_execution(student_code: StudentCode):
    # print student code

    # send the code to judge0
    # make new request to configured judge0 endpoint - current would block until done
    exec_url = os.getenv('JUDGE0_ENDPOINT') + '/submissions?base64_encoded=false&wait=true'
    
    # beautifully format the request payload
    payload = {
        'source_code': student_code.code,
        'language_id': 71, # python
    }

    # setup headers if auth key is provided
    headers = {}
    auth_key = os.getenv('JUDGE0_AUTH_KEY')
    if auth_key:
        headers['X-Auth-Token'] = auth_key

    # make request
    response = requests.post(exec_url, json=payload, headers=headers)
    
    # get the output
    output = response.json()

    # print the output using rich
    log.info(output)

    # return the output
    return output




@app.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}