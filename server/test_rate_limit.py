"""Rate limits count per signed-in student, not per network address (routers.rate_limit_key)."""

from fastapi import Depends, FastAPI, Request
from fastapi.testclient import TestClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from routers import rate_limit_key


def _app():
    limiter = Limiter(key_func=rate_limit_key)
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    async def fake_auth(request: Request):
        # Like dependencies.get_current_user_with_token.
        request.state.rate_limit_user = request.headers.get("x-user", "")

    @app.post("/execute")
    @limiter.limit("2/minute")
    async def execute(request: Request, auth=Depends(fake_auth)):
        return {"ok": True}

    return TestClient(app)


def test_students_on_one_address_get_separate_limits():
    client = _app()  # every request comes from the same test client address
    assert [client.post("/execute", headers={"x-user": "a"}).status_code for _ in range(3)] == [200, 200, 429]
    assert client.post("/execute", headers={"x-user": "b"}).status_code == 200


def test_falls_back_to_the_address_without_a_student():
    client = _app()
    assert [client.post("/execute").status_code for _ in range(3)] == [200, 200, 429]
