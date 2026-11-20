"""
Unit tests for configuration validation, typed parsing, and production safeguards.
"""

from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.config import (
    AI_SERVICE_ENV_FILE,
    EnvironmentType,
    LLMProviderType,
    Settings,
    STTProviderType,
    TTSProviderType,
)


def test_ai_service_env_file_path_is_independent_of_working_directory():
    expected = Path(__file__).resolve().parents[2] / ".env"
    assert AI_SERVICE_ENV_FILE == expected


def test_default_development_settings():
    """Verify default development configuration values."""
    settings = Settings(
        APP_ENV=EnvironmentType.DEVELOPMENT,
        SECRET_KEY="dev_secret_key_32_characters_long_for_test",
    )
    assert settings.app_env == EnvironmentType.DEVELOPMENT
    assert settings.api_v1_prefix == "/api/v1"
    assert settings.llm.provider == LLMProviderType.MOCK
    assert settings.stt.provider == STTProviderType.MOCK
    assert settings.tts.provider == TTSProviderType.MOCK
    assert settings.budget.max_interview_duration_minutes == 45


def test_log_level_validation():
    """Verify invalid log level throws validation error."""
    with pytest.raises(ValidationError):
        Settings(LOG_LEVEL="INVALID_LEVEL")


def test_service_token_algorithm_must_match_node_signer():
    with pytest.raises(ValidationError, match="ALGORITHM must be HS256"):
        Settings(
            APP_ENV=EnvironmentType.DEVELOPMENT,
            SECRET_KEY="dev_secret_key_32_characters_long_for_test",
            ALGORITHM="HS384",
        )


def test_production_rejects_debug_mode():
    """Verify production strictly forbids debug=True."""
    with pytest.raises(ValueError, match="DEBUG must be False in production"):
        Settings(
            APP_ENV=EnvironmentType.PRODUCTION,
            DEBUG=True,
            SECRET_KEY="a" * 32,
        )


def test_production_accepts_configured_gemini_groq_and_gemini_tts_providers():
    settings = Settings(
        APP_ENV=EnvironmentType.PRODUCTION,
        DEBUG=False,
        SECRET_KEY="production_service_signing_secret_at_least_32_chars",
        ALGORITHM="HS256",
        LLM={"provider": "gemini", "gemini_api_key": "test-gemini-key"},
        STT={"provider": "groq", "groq_api_key": "test-groq-key"},
        TTS={"provider": "gemini_tts", "gemini_api_key": "test-gemini-key"},
    )

    assert settings.app_env == EnvironmentType.PRODUCTION
    assert settings.debug is False
    assert settings.algorithm == "HS256"


def test_production_rejects_insecure_default_secret_key():
    """Verify production forbids default insecure secret keys."""
    with pytest.raises(
        ValueError, match="Production requires a cryptographically strong SECRET_KEY"
    ):
        Settings(
            APP_ENV=EnvironmentType.PRODUCTION,
            DEBUG=False,
            SECRET_KEY="insecure_default_secret_key_for_development_mode_only_32_chars",
        )


def test_production_rejects_short_secret_key():
    """Verify production forbids secret keys shorter than 32 characters."""
    with pytest.raises(ValueError, match="at least 32 characters"):
        Settings(
            APP_ENV=EnvironmentType.PRODUCTION,
            DEBUG=False,
            SECRET_KEY="too_short_key",
        )


@pytest.mark.parametrize(
    ("llm", "stt", "tts", "expected_provider"),
    [
        (
            {"provider": "mock"},
            {"provider": "groq", "groq_api_key": "test-groq-key"},
            {"provider": "gemini_tts", "gemini_api_key": "test-gemini-key"},
            "LLM__PROVIDER",
        ),
        (
            {"provider": "gemini", "gemini_api_key": "test-gemini-key"},
            {"provider": "mock"},
            {"provider": "gemini_tts", "gemini_api_key": "test-gemini-key"},
            "STT__PROVIDER",
        ),
        (
            {"provider": "gemini", "gemini_api_key": "test-gemini-key"},
            {"provider": "groq", "groq_api_key": "test-groq-key"},
            {"provider": "mock"},
            "TTS__PROVIDER",
        ),
    ],
)
def test_production_rejects_each_mock_provider(llm, stt, tts, expected_provider):
    with pytest.raises(ValueError, match=expected_provider):
        Settings(
            APP_ENV=EnvironmentType.PRODUCTION,
            DEBUG=False,
            SECRET_KEY="a" * 32,
            LLM=llm,
            STT=stt,
            TTS=tts,
        )


def test_production_requires_gemini_key_when_gemini_provider_selected():
    """Verify Gemini API key is mandatory when provider is set to gemini in production."""
    with pytest.raises(ValueError, match="LLM__GEMINI_API_KEY must be configured"):
        Settings(
            APP_ENV=EnvironmentType.PRODUCTION,
            DEBUG=False,
            SECRET_KEY="a" * 32,
            LLM={"provider": "gemini", "gemini_api_key": None},
            STT={"provider": "groq", "groq_api_key": "test-groq-key"},
            TTS={"provider": "gemini_tts", "gemini_api_key": "test-gemini-key"},
        )


def test_production_requires_deepgram_key_when_deepgram_provider_selected():
    """Verify Deepgram API key is mandatory when provider is set to deepgram in production."""
    with pytest.raises(ValueError, match="STT__DEEPGRAM_API_KEY must be configured"):
        Settings(
            APP_ENV=EnvironmentType.PRODUCTION,
            DEBUG=False,
            SECRET_KEY="a" * 32,
            STT={"provider": "deepgram", "deepgram_api_key": None},
            LLM={"provider": "gemini", "gemini_api_key": "test-gemini-key"},
            TTS={"provider": "gemini_tts", "gemini_api_key": "test-gemini-key"},
        )


def test_production_requires_cartesia_key_when_cartesia_provider_selected():
    """Verify Cartesia API key is mandatory when provider is set to cartesia in production."""
    with pytest.raises(ValueError, match="TTS__CARTESIA_API_KEY must be configured"):
        Settings(
            APP_ENV=EnvironmentType.PRODUCTION,
            DEBUG=False,
            SECRET_KEY="a" * 32,
            TTS={"provider": "cartesia", "cartesia_api_key": None},
            LLM={"provider": "gemini", "gemini_api_key": "test-gemini-key"},
            STT={"provider": "groq", "groq_api_key": "test-groq-key"},
        )
