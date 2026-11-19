"""
Aarohi AI Recruiter Service - Request Correlation ID Middleware.

Pure ASGI middleware for zero-overhead request tracing across microservices.
Binds correlation IDs to ContextVar and injects X-Correlation-ID response header.
"""

import uuid

from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.logging import correlation_id_ctx


class CorrelationIdMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Extract X-Correlation-ID header from ASGI scope
        correlation_id = None
        for name, value in scope.get("headers", []):
            if name.lower() == b"x-correlation-id":
                correlation_id = value.decode("latin1")
                break

        if not correlation_id:
            correlation_id = str(uuid.uuid4())

        token = correlation_id_ctx.set(correlation_id)

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"x-correlation-id", correlation_id.encode("latin1")))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            correlation_id_ctx.reset(token)
