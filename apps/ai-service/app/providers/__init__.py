"""
Provider registry — factory functions for LLM, STT, and TTS providers.
Reads configuration and returns the appropriate concrete implementation.
"""

from app.core.config import LLMProviderType, STTProviderType, TTSProviderType, get_settings
from app.providers.interfaces import LLMProvider, STTProvider, TTSProvider


def get_llm_provider() -> LLMProvider:
    settings = get_settings()
    if settings.llm.provider == LLMProviderType.GEMINI:
        from app.providers.llm.gemini import GeminiLLMProvider
        api_key = settings.llm.gemini_api_key
        if not api_key:
            raise RuntimeError("LLM__GEMINI_API_KEY is not set")
        return GeminiLLMProvider(
            api_key=api_key.get_secret_value(),
            model=settings.llm.model,
            timeout=settings.llm.request_timeout_seconds,
        )
    # Default: mock
    from app.providers.llm.mock import MockLLMProvider
    return MockLLMProvider()


def get_stt_provider() -> STTProvider:
    settings = get_settings()
    if settings.stt.provider == STTProviderType.GROQ:
        from app.providers.stt.groq import GroqSTTProvider
        api_key = settings.stt.groq_api_key
        if not api_key:
            raise RuntimeError("STT__GROQ_API_KEY is not set")
        return GroqSTTProvider(
            api_key=api_key.get_secret_value(),
            model=settings.stt.model,
            language=settings.stt.language,
        )
    # Default: mock
    from app.providers.stt.mock import MockSTTProvider
    return MockSTTProvider()


def get_tts_provider() -> TTSProvider:
    settings = get_settings()
    if settings.tts.provider == TTSProviderType.GEMINI_TTS:
        from app.providers.tts.gemini_tts import GeminiTTSProvider
        api_key = settings.tts.gemini_api_key
        if not api_key:
            raise RuntimeError("TTS__GEMINI_API_KEY is not set")
        return GeminiTTSProvider(
            api_key=api_key.get_secret_value(),
            model=settings.tts.model,
            voice_id=settings.tts.voice_id,
        )
    # Default: mock
    from app.providers.tts.mock import MockTTSProvider
    return MockTTSProvider()
