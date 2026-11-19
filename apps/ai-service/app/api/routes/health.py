"""
Aarohi AI Recruiter Service - Health & Diagnostics Routes.

Endpoints for Kubernetes / container liveness probes, readiness checks,
and safe diagnostic reporting.
"""

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, status

from app.core.config import LLMProviderType, STTProviderType, TTSProviderType, get_settings

router = APIRouter(prefix="/health", tags=["Health & Diagnostics"])


@router.get("/live", status_code=status.HTTP_200_OK)
def liveness_probe() -> dict[str, str]:
    """Liveness probe to confirm the container/process is running."""
    return {"status": "alive"}


@router.get("/ready", status_code=status.HTTP_200_OK)
def readiness_probe() -> dict[str, Any]:
    """Readiness probe to confirm configurations and providers are initialized."""
    settings = get_settings()

    return {
        "status": "ready",
        "service": settings.app_name,
        "environment": settings.app_env.value,
        "timestamp": datetime.now(UTC).isoformat(),
        "providers": {
            "llm": {
                "provider": settings.llm.provider.value,
                "model": settings.llm.model,
                "configured": (
                    settings.llm.provider == LLMProviderType.MOCK
                    or bool(settings.llm.gemini_api_key or settings.llm.openai_api_key)
                ),
            },
            "stt": {
                "provider": settings.stt.provider.value,
                "model": settings.stt.model,
                "configured": (
                    settings.stt.provider == STTProviderType.MOCK
                    or bool(settings.stt.deepgram_api_key)
                ),
            },
            "tts": {
                "provider": settings.tts.provider.value,
                "model": settings.tts.model,
                "configured": (
                    settings.tts.provider == TTSProviderType.MOCK
                    or (
                        settings.tts.provider == TTSProviderType.GEMINI_TTS
                        and bool(settings.tts.gemini_api_key)
                    )
                    or (
                        settings.tts.provider == TTSProviderType.CARTESIA
                        and bool(settings.tts.cartesia_api_key)
                    )
                ),
            },
            "livekit": {
                "url": settings.livekit.url,
                "agent_name": settings.livekit.agent_name,
                "configured": bool(settings.livekit.api_key and settings.livekit.api_secret),
            },
        },
    }


@router.get("/diagnostics", status_code=status.HTTP_200_OK)
def diagnostics_report() -> dict[str, Any]:
    """
    Detailed operational diagnostics report.
    Returns safe configuration and budget limits without exposing any secrets.
    """
    settings = get_settings()

    return {
        "service": settings.app_name,
        "environment": settings.app_env.value,
        "debug": settings.debug,
        "budget_limits": {
            "max_interview_duration_minutes": settings.budget.max_interview_duration_minutes,
            "max_tokens_per_interview": settings.budget.max_tokens_per_interview,
            "max_concurrent_interviews": settings.budget.max_concurrent_interviews,
            "cost_alert_threshold_usd": settings.budget.cost_alert_threshold_usd,
        },
        "cors_origins": settings.cors_origins,
        "log_level": settings.log_level,
        "log_format": settings.log_format.value,
        "sensitive_data_masking_enabled": settings.enable_sensitive_data_masking,
    }
