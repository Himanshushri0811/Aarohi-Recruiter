"""
Mock TTS provider for unit tests.
Returns a minimal valid WAV file without calling any external APIs.
"""

import struct

from app.providers.interfaces import TTSProvider, AudioResult


def _silent_wav(duration_ms: int = 100, sample_rate: int = 24000) -> bytes:
    """Generate a silent WAV buffer for testing."""
    num_samples = int(sample_rate * duration_ms / 1000)
    pcm = b"\x00\x00" * num_samples  # 16-bit silence
    data_size = len(pcm)
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE", b"fmt ",
        16, 1, 1, sample_rate, sample_rate * 2, 2, 16,
        b"data", data_size,
    )
    return header + pcm


class MockTTSProvider(TTSProvider):
    """In-process mock TTS for automated tests only."""

    async def synthesize(
        self,
        text: str,
        voice_id: str | None = None,
    ) -> AudioResult:
        return AudioResult(
            audio_bytes=_silent_wav(),
            mime_type="audio/wav",
            sample_rate=24000,
            duration_seconds=0.1,
        )

    async def health_check(self) -> bool:
        return True
