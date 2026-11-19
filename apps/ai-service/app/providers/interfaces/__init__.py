"""
Abstract provider interfaces for LLM, STT, and TTS.
All concrete provider implementations must inherit from these base classes.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class Message:
    role: str  # "user" | "assistant" | "system"
    content: str


@dataclass
class LLMResponse:
    text: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    finish_reason: str = "stop"


@dataclass
class TranscriptionResult:
    text: str
    language: str = "en"
    confidence: float = 1.0
    duration_seconds: float = 0.0
    words: list[dict] = field(default_factory=list)


@dataclass
class AudioResult:
    """WAV audio bytes ready for browser playback."""
    audio_bytes: bytes
    mime_type: str = "audio/wav"
    sample_rate: int = 24000
    duration_seconds: float = 0.0


class LLMProvider(ABC):
    """Abstract base for Large Language Model providers."""

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system: str | None = None,
        history: list[Message] | None = None,
        response_json: bool = False,
    ) -> LLMResponse:
        """Generate a text response from the LLM."""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Return True if the provider is reachable."""
        ...


class STTProvider(ABC):
    """Abstract base for Speech-to-Text providers."""

    @abstractmethod
    async def transcribe(
        self,
        audio_bytes: bytes,
        mime_type: str = "audio/webm",
        language: str | None = None,
    ) -> TranscriptionResult:
        """Transcribe audio bytes to text. File-based (non-streaming)."""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Return True if the provider is reachable."""
        ...


class TTSProvider(ABC):
    """Abstract base for Text-to-Speech providers."""

    @abstractmethod
    async def synthesize(
        self,
        text: str,
        voice_id: str | None = None,
    ) -> AudioResult:
        """Synthesize text to WAV audio bytes."""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Return True if the provider is reachable."""
        ...
