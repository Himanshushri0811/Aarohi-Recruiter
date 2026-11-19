"""
Groq Whisper STT provider.

Uses Groq's OpenAI-compatible transcription endpoint.
Important: Groq Whisper is FILE-BASED (not streaming).
The interview uses a turn-based model: candidate records → submits audio → Groq transcribes.

ROOT CAUSE FIX (2026-11-19):
  Groq Whisper only accepts ISO 639-1 two-letter language codes (e.g. "en", "hi", "fr").
  Locale-qualified tags such as "en-IN", "en-US", "hi-IN" are REJECTED with HTTP 400:
    {"error": {"message": "unsupported language: en-IN", "code": "invalid_language"}}
  The _normalize_language() helper strips the region subtag before every request.
"""

import io
import logging
import re

import httpx

from app.providers.interfaces import STTProvider, TranscriptionResult

logger = logging.getLogger(__name__)

_GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions"

# Map browser MIME types to file extensions Groq accepts
_MIME_TO_EXT = {
    "audio/webm": "webm",
    "audio/webm;codecs=opus": "webm",
    "audio/ogg": "ogg",
    "audio/ogg;codecs=opus": "ogg",
    "audio/wav": "wav",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/aac": "mp4",
}

# Minimum meaningful audio payload (a valid WAV header alone is 44 bytes;
# anything shorter cannot contain real audio data).
_MIN_AUDIO_BYTES = 100


def _normalize_language(lang: str) -> str:
    """
    Groq Whisper requires ISO 639-1 two-letter codes.
    Strip any BCP-47 region/script subtags (e.g. en-IN → en, hi-IN → hi).
    Returns an empty string to signal auto-detect when the input is falsy.
    """
    if not lang or not lang.strip():
        return ""
    # Take only the primary language subtag
    primary = re.split(r"[-_]", lang.strip())[0].lower()
    return primary


class GroqSTTProvider(STTProvider):
    """
    Calls Groq's /openai/v1/audio/transcriptions endpoint.

    Supported models:
    - whisper-large-v3-turbo (preferred — fastest)
    - whisper-large-v3 (higher accuracy)

    Supported audio: webm, ogg, wav, mp4, mp3 up to 25 MB.
    """

    def __init__(
        self,
        api_key: str,
        model: str = "whisper-large-v3-turbo",
        language: str = "en",
        timeout: float = 30.0,
    ):
        self._api_key = api_key
        self._model = model
        # Normalize at construction time so callers never need to remember
        self._language = _normalize_language(language)
        self._timeout = timeout

    async def transcribe(
        self,
        audio_bytes: bytes,
        mime_type: str = "audio/webm",
        language: str | None = None,
    ) -> TranscriptionResult:
        # ------------------------------------------------------------------ #
        # 1. Guard: empty or trivially small payloads are always a mistake.   #
        #    Sending them wastes a Groq API call and returns HTTP 400.         #
        # ------------------------------------------------------------------ #
        if not audio_bytes or len(audio_bytes) < _MIN_AUDIO_BYTES:
            raise ValueError(
                f"Audio payload too small ({len(audio_bytes)} bytes). "
                "Recording may be empty or the MediaRecorder did not capture any data."
            )

        # ------------------------------------------------------------------ #
        # 2. MIME → extension mapping                                          #
        # ------------------------------------------------------------------ #
        clean_mime = mime_type.split(";")[0].strip().lower()
        ext = _MIME_TO_EXT.get(clean_mime, "webm")
        filename = f"audio.{ext}"

        # ------------------------------------------------------------------ #
        # 3. Normalize language to ISO 639-1 (strips locale like "en-IN")     #
        # ------------------------------------------------------------------ #
        raw_lang = language if language is not None else self._language
        lang = _normalize_language(raw_lang)

        logger.debug(
            "Groq STT request: model=%s lang=%s (raw=%s) mime=%s bytes=%d",
            self._model, lang or "auto", raw_lang, mime_type, len(audio_bytes),
        )

        headers = {"Authorization": f"Bearer {self._api_key}"}

        # Groq expects multipart/form-data with the audio file.
        # Pass the *clean* MIME type as the content-type for the file part.
        files = {"file": (filename, io.BytesIO(audio_bytes), clean_mime)}
        data: dict[str, str] = {
            "model": self._model,
            "response_format": "verbose_json",
        }
        # Only send language when we have a valid code; omitting it triggers
        # Whisper's own language auto-detection which is safer than a bad code.
        if lang:
            data["language"] = lang

        # ------------------------------------------------------------------ #
        # 4. HTTP request with structured error capture                        #
        # ------------------------------------------------------------------ #
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    _GROQ_TRANSCRIPTION_URL,
                    headers=headers,
                    files=files,
                    data=data,
                )
                if not resp.is_success:
                    error_body = resp.text
                    logger.error(
                        "Groq STT HTTP %d: %s",
                        resp.status_code,
                        error_body,
                    )
                    resp.raise_for_status()
        except httpx.TimeoutException as exc:
            raise TimeoutError(
                f"Groq STT request timed out after {self._timeout}s"
            ) from exc
        except httpx.HTTPStatusError:
            # Already logged above with the full Groq error body; re-raise so
            # the route handler can return a meaningful 502 to the frontend.
            raise

        # ------------------------------------------------------------------ #
        # 5. Parse response                                                     #
        # ------------------------------------------------------------------ #
        result = resp.json()
        text = result.get("text", "").strip()

        logger.info(
            "Groq STT success: lang=%s duration=%.2fs transcript_len=%d",
            result.get("language", lang),
            result.get("duration", 0.0),
            len(text),
        )

        return TranscriptionResult(
            text=text,
            language=result.get("language", lang or "unknown"),
            confidence=1.0,  # Groq does not expose per-segment confidence
            duration_seconds=result.get("duration", 0.0),
            words=result.get("words", []),
        )

    async def health_check(self) -> bool:
        """Groq STT has no lightweight ping — check API key validity via model list."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                )
                return resp.status_code == 200
        except Exception as e:
            logger.warning("Groq STT health check failed: %s", e)
            return False
