"""
Aarohi AI Recruiter Service - Centralized Configuration and Environment Validation.

Built with Pydantic v2 and pydantic-settings. Enforces strict environment
validation, type checking, security safeguards, and provider settings.
"""

from enum import Enum
from functools import lru_cache
from pathlib import Path

from pydantic import (
    BaseModel,
    Field,
    SecretStr,
    field_validator,
    model_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict

AI_SERVICE_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class EnvironmentType(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"


class LogFormat(str, Enum):
    JSON = "json"
    TEXT = "text"


class LLMProviderType(str, Enum):
    GEMINI = "gemini"
    OPENAI = "openai"
    MOCK = "mock"


class STTProviderType(str, Enum):
    GROQ = "groq"
    DEEPGRAM = "deepgram"
    MOCK = "mock"


class TTSProviderType(str, Enum):
    GEMINI_TTS = "gemini_tts"
    CARTESIA = "cartesia"
    MOCK = "mock"


class LLMSettings(BaseModel):
    provider: LLMProviderType = Field(default=LLMProviderType.MOCK)
    model: str = Field(default="gemini-3.1-flash-lite")
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)
    max_tokens: int = Field(default=2048, ge=64, le=8192)
    request_timeout_seconds: float = Field(default=60.0, ge=1.0, le=120.0)
    gemini_api_key: SecretStr | None = Field(default=None)
    openai_api_key: SecretStr | None = Field(default=None)


class STTSettings(BaseModel):
    provider: STTProviderType = Field(default=STTProviderType.MOCK)
    model: str = Field(default="whisper-large-v3-turbo")
    # Language must be an ISO 639-1 two-letter code (e.g. "en", "hi").
    # Locale-qualified tags like "en-IN" are REJECTED by Groq with HTTP 400.
    # The validator strips any region/script subtags automatically.
    language: str = Field(default="en")
    # Groq Whisper (file-based, not streaming)
    groq_api_key: SecretStr | None = Field(default=None)
    # Deepgram (legacy / alternative)
    deepgram_api_key: SecretStr | None = Field(default=None)

    @field_validator("language", mode="before")
    @classmethod
    def normalize_language_code(cls, v: str) -> str:
        """Strip BCP-47 region subtags so Groq never receives 'en-IN', 'hi-IN' etc."""
        import re
        if not v or not v.strip():
            return "en"
        return re.split(r"[-_]", v.strip())[0].lower()


class TTSSettings(BaseModel):
    provider: TTSProviderType = Field(default=TTSProviderType.MOCK)
    # Gemini TTS — returns PCM L16 at 24kHz, converted to WAV for browser
    model: str = Field(default="gemini-3.1-flash-tts-preview")
    voice_id: str = Field(default="Aoede")
    gemini_api_key: SecretStr | None = Field(default=None)
    # Cartesia (legacy / alternative)
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    cartesia_api_key: SecretStr | None = Field(default=None)


class LiveKitSettings(BaseModel):
    url: str = Field(default="")
    api_key: str = Field(default="")
    api_secret: SecretStr = Field(default=SecretStr(""))
    agent_name: str = Field(default="aarohi-interviewer")
    ping_timeout_seconds: float = Field(default=15.0, ge=5.0, le=60.0)

    @property
    def is_configured(self) -> bool:
        """LiveKit is only enabled when real credentials are provided."""
        return bool(self.url and self.api_key and self.api_secret.get_secret_value())


class RedisSettings(BaseModel):
    host: str = Field(default="localhost")
    port: int = Field(default=6379, ge=1, le=65535)
    password: SecretStr | None = Field(default=None)
    db: int = Field(default=0, ge=0, le=15)
    ssl: bool = Field(default=False)
    timeout_seconds: float = Field(default=5.0, ge=0.5, le=30.0)


class CostBudgetSettings(BaseModel):
    max_interview_duration_minutes: int = Field(default=45, ge=5, le=180)
    max_tokens_per_interview: int = Field(default=15000, ge=1000, le=100000)
    max_audio_minutes_per_interview: int = Field(default=50, ge=5, le=200)
    max_concurrent_interviews: int = Field(default=20, ge=1, le=500)
    cost_alert_threshold_usd: float = Field(default=5.0, ge=0.5)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=AI_SERVICE_ENV_FILE,
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        extra="ignore",
    )

    # Core Application Settings
    app_env: EnvironmentType = Field(default=EnvironmentType.DEVELOPMENT, alias="APP_ENV")
    app_name: str = Field(default="aarohi-ai-service", alias="APP_NAME")
    debug: bool = Field(default=False, alias="DEBUG")
    api_v1_prefix: str = Field(default="/api/v1", alias="API_V1_PREFIX")
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, ge=1, le=65535, alias="PORT")

    # Security & Auth
    secret_key: SecretStr = Field(
        default=SecretStr("insecure_default_secret_key_for_development_mode_only_32_chars"),
        alias="SECRET_KEY",
    )
    algorithm: str = Field(default="HS256", alias="ALGORITHM")
    service_token_ttl_seconds: int = Field(
        default=3600, ge=60, le=86400, alias="SERVICE_TOKEN_TTL_SECONDS"
    )
    allowed_organization_ids: list[str] = Field(
        default_factory=list, alias="ALLOWED_ORGANIZATION_IDS"
    )

    # Logging & Observability
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    log_format: LogFormat = Field(default=LogFormat.JSON, alias="LOG_FORMAT")
    enable_sensitive_data_masking: bool = Field(default=True, alias="ENABLE_SENSITIVE_DATA_MASKING")

    # Subsystems
    llm: LLMSettings = Field(default_factory=LLMSettings)
    stt: STTSettings = Field(default_factory=STTSettings)
    tts: TTSSettings = Field(default_factory=TTSSettings)
    livekit: LiveKitSettings = Field(default_factory=LiveKitSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    budget: CostBudgetSettings = Field(default_factory=CostBudgetSettings)

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper = v.upper()
        if upper not in valid_levels:
            raise ValueError(f"Invalid LOG_LEVEL '{v}'. Must be one of {valid_levels}")
        return upper

    @field_validator("algorithm")
    @classmethod
    def validate_service_token_algorithm(cls, value: str) -> str:
        if value != "HS256":
            raise ValueError("ALGORITHM must be HS256 for internal service tokens")
        return value

    @model_validator(mode="after")
    def validate_production_safeguards(self) -> "Settings":
        """
        Enforce strict production validation to prevent security leaks
        or startup misconfigurations in staging and production environments.
        """
        if self.app_env in (EnvironmentType.PRODUCTION, EnvironmentType.STAGING):
            if self.debug and self.app_env == EnvironmentType.PRODUCTION:
                raise ValueError("DEBUG must be False in production environment")

            raw_secret = self.secret_key.get_secret_value()
            if (
                "insecure_default" in raw_secret
                or "change_this_to" in raw_secret
                or len(raw_secret) < 32
            ):
                raise ValueError(
                    "Production requires a cryptographically strong SECRET_KEY "
                    "with at least 32 characters."
                )

            if self.llm.provider == LLMProviderType.GEMINI:
                if not self.llm.gemini_api_key or not self.llm.gemini_api_key.get_secret_value():
                    raise ValueError(
                        "LLM__GEMINI_API_KEY must be configured when LLM__PROVIDER is 'gemini'"
                    )
            elif self.llm.provider == LLMProviderType.OPENAI:
                if not self.llm.openai_api_key or not self.llm.openai_api_key.get_secret_value():
                    raise ValueError(
                        "LLM__OPENAI_API_KEY must be configured when LLM__PROVIDER is 'openai'"
                    )

            if self.stt.provider == STTProviderType.GROQ:
                if not self.stt.groq_api_key or not self.stt.groq_api_key.get_secret_value():
                    raise ValueError(
                        "STT__GROQ_API_KEY must be configured when STT__PROVIDER is 'groq'"
                    )

            if self.stt.provider == STTProviderType.DEEPGRAM:
                if not self.stt.deepgram_api_key or not self.stt.deepgram_api_key.get_secret_value():
                    raise ValueError(
                        "STT__DEEPGRAM_API_KEY must be configured when STT__PROVIDER is 'deepgram'"
                    )

            if self.tts.provider == TTSProviderType.CARTESIA:
                if not self.tts.cartesia_api_key or not self.tts.cartesia_api_key.get_secret_value():
                    raise ValueError(
                        "TTS__CARTESIA_API_KEY must be configured when TTS__PROVIDER is 'cartesia'"
                    )

            if self.tts.provider == TTSProviderType.GEMINI_TTS:
                if not self.tts.gemini_api_key or not self.tts.gemini_api_key.get_secret_value():
                    raise ValueError(
                        "TTS__GEMINI_API_KEY must be configured when TTS__PROVIDER is 'gemini_tts'"
                    )

            if self.app_env == EnvironmentType.PRODUCTION:
                mock_providers = [
                    name
                    for name, provider in (
                        ("LLM__PROVIDER", self.llm.provider),
                        ("STT__PROVIDER", self.stt.provider),
                        ("TTS__PROVIDER", self.tts.provider),
                    )
                    if provider.value == "mock"
                ]
                if mock_providers:
                    raise ValueError(
                        "Mock providers are not allowed in production: "
                        + ", ".join(mock_providers)
                    )
        else:
            raw_secret = self.secret_key.get_secret_value()
            if (
                "insecure_default" in raw_secret
                or "change_this_to" in raw_secret
                or len(raw_secret) < 32
            ):
                raise ValueError(
                    "SECRET_KEY must be configured with at least 32 characters for service authentication"
                )

        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Returns the cached application settings singleton.
    Cached with LRU cache to avoid re-parsing environment variables on every call.
    """
    return Settings()
