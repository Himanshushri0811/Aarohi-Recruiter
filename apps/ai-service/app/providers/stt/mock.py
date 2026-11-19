"""
Mock STT provider for unit tests.
"""

from app.providers.interfaces import STTProvider, TranscriptionResult


class MockSTTProvider(STTProvider):
    """In-process mock STT for automated tests only."""

    def __init__(self, transcript: str = "Mock transcription response"):
        self._transcript = transcript

    async def transcribe(
        self,
        audio_bytes: bytes,
        mime_type: str = "audio/webm",
        language: str | None = None,
    ) -> TranscriptionResult:
        return TranscriptionResult(
            text=self._transcript,
            language=language or "en",
            confidence=1.0,
            duration_seconds=5.0,
        )

    async def health_check(self) -> bool:
        return True
