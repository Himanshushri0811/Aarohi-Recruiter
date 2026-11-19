import asyncio
import json
import os
import sys
from pathlib import Path

# Add apps/ai-service to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ["APP_ENV"] = "testing"
os.environ["SECRET_KEY"] = "test_cryptographically_secure_key_for_unit_tests_32_chars_min"

from app.main import create_app


class Response:
    def __init__(self, status_code, headers, body):
        self.status_code = status_code
        self.headers = headers
        self.content = body

    def json(self):
        return json.loads(self.content.decode("utf-8"))


class ASGITestClient:
    def __init__(self, app):
        self.app = app

    async def get(self, path: str, headers: dict = None):
        raw_headers = [
            (k.lower().encode("latin1"), v.encode("latin1")) for k, v in (headers or {}).items()
        ]
        scope = {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "GET",
            "path": path,
            "raw_path": path.encode(),
            "query_string": b"",
            "headers": raw_headers,
        }
        body, res_headers, status = [], {}, [200]

        async def receive():
            return {"type": "http.request", "body": b"", "more_body": False}

        async def send(msg):
            if msg["type"] == "http.response.start":
                status[0] = msg["status"]
                for k, v in msg.get("headers", []):
                    res_headers[k.decode("latin1")] = v.decode("latin1")
            elif msg["type"] == "http.response.body":
                body.append(msg.get("body", b""))

        await self.app(scope, receive, send)
        return Response(status[0], res_headers, b"".join(body))


async def main():
    print("Testing create_app()...")
    app = create_app()
    client = ASGITestClient(app)

    print("Testing /health/live...")
    res = await client.get("/health/live")
    print(
        f"  Status: {res.status_code}, Body: {res.json()}, Correlation: {res.headers.get('x-correlation-id')}"
    )
    assert res.status_code == 200
    assert res.json()["status"] == "alive"

    print("Testing /health/ready...")
    res = await client.get("/health/ready")
    print(f"  Status: {res.status_code}, Providers: {list(res.json()['providers'].keys())}")
    assert res.status_code == 200

    print("Testing /health/diagnostics...")
    res = await client.get("/health/diagnostics")
    print(f"  Status: {res.status_code}, Budget: {res.json()['budget_limits']}")
    assert res.status_code == 200

    print("Testing / root...")
    res = await client.get("/")
    print(f"  Status: {res.status_code}, Name: {res.json()['name']}")
    assert res.status_code == 200

    print("\nALL SMOKE TESTS PASSED SUCCESSFULLY!")


if __name__ == "__main__":
    asyncio.run(main())
