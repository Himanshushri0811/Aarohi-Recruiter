"""
Aarohi AI Recruiter Service - Application Entrypoint.

FastAPI application factory, middleware configuration, exception handlers,
and route registrations.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.middleware.correlation import CorrelationIdMiddleware
from app.api.middleware.error_handler import (
    aarohi_exception_handler,
    unhandled_exception_handler,
)
from app.api.routes.health import router as health_router
from app.api.routes.resume import router as resume_router
from app.api.routes.interview import router as interview_router
from app.core.config import EnvironmentType, get_settings
from app.core.exceptions import AarohiException
from app.core.lifecycle import lifespan


def create_app() -> FastAPI:
    """Create and configure the FastAPI application instance."""
    settings = get_settings()

    # Disable interactive Swagger / Redoc in production
    is_prod = settings.app_env == EnvironmentType.PRODUCTION
    docs_url = None if is_prod else "/docs"
    redoc_url = None if is_prod else "/redoc"
    openapi_url = None if is_prod else "/openapi.json"

    app = FastAPI(
        title="Aarohi AI Recruiter Service",
        description="Production-grade AI Interview Assistant microservice for AI Recruiter SaaS",
        version="0.1.0",
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=openapi_url,
        lifespan=lifespan,
    )

    # 1. Register Cross-Origin Resource Sharing (CORS)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # 2. Register Request Tracing Middleware
    app.add_middleware(CorrelationIdMiddleware)

    # 3. Register Domain Exception Handlers
    app.add_exception_handler(AarohiException, aarohi_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    # 4. Register Routes
    # Root level health for container orchestrator probes
    app.include_router(health_router)
    # Versioned API routes
    app.include_router(health_router, prefix=settings.api_v1_prefix)
    app.include_router(resume_router, prefix=settings.api_v1_prefix)
    app.include_router(interview_router, prefix=settings.api_v1_prefix)

    @app.get("/", tags=["Root"])
    def root():
        return {
            "name": settings.app_name,
            "version": "0.1.0",
            "environment": settings.app_env.value,
            "agent": "Aarohi (AI Interviewer)",
            "status": "operational",
        }

    return app


app = create_app()
