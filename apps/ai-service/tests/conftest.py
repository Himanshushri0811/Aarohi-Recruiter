"""
Aarohi AI Recruiter Service - Test Fixtures and Configuration.
"""

import os
import sys
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure apps/ai-service is first in sys.path before any external packages
AI_SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(AI_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_ROOT))

# Ensure test environment mode is active before importing application settings
os.environ["APP_ENV"] = "testing"
os.environ["SECRET_KEY"] = "shared_test_service_secret_for_node_fastapi_hmac_32_chars"
os.environ["LLM__PROVIDER"] = "mock"
os.environ["STT__PROVIDER"] = "mock"
os.environ["TTS__PROVIDER"] = "mock"

from app.core.config import get_settings
from app.main import create_app


@pytest.fixture(autouse=True)
def reset_settings_cache():
    """Clear lru_cache for settings before each test."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def test_client() -> Generator[TestClient, None, None]:
    """Provide a FastAPI TestClient instance."""
    app = create_app()
    with TestClient(app) as client:
        yield client
