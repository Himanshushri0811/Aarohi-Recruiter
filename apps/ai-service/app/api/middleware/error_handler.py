"""
Aarohi AI Recruiter Service - Global Exception Handler Middleware.

Transforms domain exceptions into consistent, typed JSON error payloads
without leaking stack traces, credentials, or internal details to API clients.
"""

from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.exceptions import AarohiException
from app.core.logging import get_logger

logger = get_logger(__name__)


async def aarohi_exception_handler(request: Request, exc: AarohiException) -> JSONResponse:
    """Handle known domain exceptions with standard error format."""
    logger.warning(
        f"Handled domain exception: {exc.code} - {exc.message}",
        extra={
            "error_code": exc.code,
            "status_code": exc.status_code,
            "path": request.url.path,
            "method": request.method,
            "details": exc.details,
        },
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            },
        },
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected server errors, ensuring sensitive tracebacks are not leaked."""
    logger.exception(
        f"Unhandled server error on {request.method} {request.url.path}: {str(exc)}",
        extra={
            "path": request.url.path,
            "method": request.method,
        },
    )
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected internal server error occurred. Please contact support.",
                "details": {},
            },
        },
    )
