"""
Integration tests for FastAPI endpoints: root, health probes, and diagnostics.
"""

from pydantic import SecretStr

from app.api.routes.health import diagnostics_report, liveness_probe, readiness_probe
from app.core.config import TTSProviderType, get_settings
from app.main import create_app


def test_root_endpoint():
    """Verify service root metadata endpoint."""
    app = create_app()
    route = next(r for r in app.routes if getattr(r, "path", None) == "/")
    data = route.endpoint()
    assert data["name"] == "aarohi-ai-service"
    assert data["agent"] == "Aarohi (AI Interviewer)"
    assert data["status"] == "operational"
    assert data["version"] == "0.1.0"


def test_ai_service_does_not_allow_browser_cors(test_client):
    response = test_client.options(
        "/api/v1/resume/analyze",
        headers={
            "Origin": "https://aarohi-recruiter-camd.vercel.app",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 405
    assert "access-control-allow-origin" not in response.headers


def test_liveness_probe():
    """Verify /health/live returns 200 alive status."""
    data = liveness_probe()
    assert data["status"] == "alive"


def test_readiness_probe(monkeypatch):
    """Verify /health/ready returns provider status checks."""
    settings = get_settings()
    settings.livekit.url = "wss://livekit.example.com"
    settings.livekit.api_key = "test-livekit-key"
    settings.livekit.api_secret = SecretStr("test-livekit-secret")
    monkeypatch.setattr("app.api.routes.health.get_settings", lambda: settings)

    data = readiness_probe()
    assert data["status"] == "ready"
    assert "providers" in data
    assert data["providers"]["llm"]["provider"] == "mock"
    assert data["providers"]["stt"]["provider"] == "mock"
    assert data["providers"]["tts"]["provider"] == "mock"
    assert data["providers"]["livekit"]["configured"] is True


def test_readiness_probe_checks_gemini_tts_key(monkeypatch):
    settings = get_settings()
    settings.tts.provider = TTSProviderType.GEMINI_TTS
    settings.tts.gemini_api_key = SecretStr("test-gemini-api-key")
    monkeypatch.setattr("app.api.routes.health.get_settings", lambda: settings)

    data = readiness_probe()

    assert data["providers"]["tts"]["configured"] is True


def test_diagnostics_probe():
    """Verify /health/diagnostics returns budget limits and safe config."""
    data = diagnostics_report()
    assert data["service"] == "aarohi-ai-service"
    assert "budget_limits" in data
    assert data["budget_limits"]["max_interview_duration_minutes"] == 45
    assert data["sensitive_data_masking_enabled"] is True
    assert "cors_origins" not in data


def test_router_registration():
    """Verify all health and root routes are properly wired in FastAPI app."""
    app = create_app()
    paths = set(app.openapi()["paths"].keys())
    assert "/" in paths
    assert "/health/live" in paths
    assert "/health/ready" in paths
    assert "/health/diagnostics" in paths
    assert "/api/v1/health/live" in paths
    assert "/api/v1/health/ready" in paths
    assert "/api/v1/health/diagnostics" in paths
