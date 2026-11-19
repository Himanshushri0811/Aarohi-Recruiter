"""
Gemini TTS provider.

Gemini 3.8 returns WAV audio for unary requests. Older Gemini TTS models return
headerless PCM, which is wrapped in WAV for browser playback.
"""

import asyncio
import base64
import binascii
import io
import json
import logging
import re
import struct
import time
import wave
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from typing import Any

import httpx

from app.providers.interfaces import AudioResult, TTSProvider

logger = logging.getLogger(__name__)

_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
_FALLBACK_MODELS = (
    "gemini-3.8-flash-lite-tts",
    "gemini-3.1-flash-tts-preview",
)
_MAX_ATTEMPTS_PER_MODEL = 2
_BACKOFF_SECONDS = 0.25
_DEFAULT_429_COOLDOWN_SECONDS = 30.0
_MAX_429_COOLDOWN_SECONDS = 86400.0
_TRANSIENT_COOLDOWN_SECONDS = 5.0
_MODEL_COOLDOWNS: dict[str, float] = {}


def _pcm_to_wav(
    pcm_bytes: bytes,
    sample_rate: int = 24000,
    channels: int = 1,
    bit_depth: int = 16,
) -> bytes:
    """Convert raw PCM L16 bytes to a valid WAV container."""
    bytes_per_sample = bit_depth // 8
    if not pcm_bytes or len(pcm_bytes) % (bytes_per_sample * channels):
        raise ValueError("Gemini returned empty or incomplete PCM audio")

    byte_rate = sample_rate * channels * bytes_per_sample
    block_align = channels * bytes_per_sample
    data_size = len(pcm_bytes)
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + data_size,
        b"WAVE",
        b"fmt ",
        16,
        1,
        channels,
        sample_rate,
        byte_rate,
        block_align,
        bit_depth,
        b"data",
        data_size,
    )
    return header + pcm_bytes


def _inspect_wav(audio_bytes: bytes) -> tuple[int, float]:
    if len(audio_bytes) <= 44:
        raise ValueError("Gemini returned empty WAV audio")

    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wav:
            sample_rate = wav.getframerate()
            frame_count = wav.getnframes()
            if wav.getcomptype() != "NONE" or sample_rate <= 0 or frame_count <= 0:
                raise ValueError("Gemini returned invalid WAV audio")
            return sample_rate, frame_count / sample_rate
    except (wave.Error, EOFError) as exc:
        raise ValueError("Gemini returned invalid WAV audio") from exc


def _safe_text(value: Any, secrets: tuple[str, ...]) -> str:
    text = str(value)
    for secret in secrets:
        if secret:
            text = text.replace(secret, "[REDACTED]")
    text = re.sub(r"AIza[0-9A-Za-z_-]{20,}", "[REDACTED_API_KEY]", text)
    text = re.sub(
        r"(?i)(x-goog-api-key|api[_ -]?key)(\s*[:=]\s*)[^\s,;\"']+",
        r"\1\2[REDACTED]",
        text,
    )
    text = re.sub(r"(?i)([?&]key=)[^&\s]+", r"\1[REDACTED]", text)
    text = re.sub(r"(?i)bearer\s+\S+", "Bearer [REDACTED]", text)
    return text[:512]


def _safe_error_summary(
    response: httpx.Response,
    api_key: str,
    request_text: str,
) -> dict[str, Any]:
    try:
        body = response.json()
    except ValueError:
        body = None

    summary: dict[str, Any] = {"http_status": response.status_code}
    error = body.get("error") if isinstance(body, dict) else None
    if isinstance(error, dict):
        if isinstance(error.get("code"), int):
            summary["provider_code"] = error["code"]
        elif isinstance(error.get("code"), str):
            summary["provider_code"] = _safe_text(
                error["code"], (api_key, request_text)
            )
        if isinstance(error.get("status"), str):
            summary["provider_status"] = _safe_text(error["status"], (api_key, request_text))
        if isinstance(error.get("message"), str):
            summary["message"] = _safe_text(error["message"], (api_key, request_text))

        safe_details: list[dict[str, Any]] = []
        details = error.get("details")
        if isinstance(details, list):
            for detail in details:
                if not isinstance(detail, dict):
                    continue
                safe_detail: dict[str, Any] = {}
                if isinstance(detail.get("@type"), str):
                    safe_detail["type"] = _safe_text(
                        detail["@type"], (api_key, request_text)
                    )
                if isinstance(detail.get("retryDelay"), str):
                    safe_detail["retry_delay"] = _safe_text(
                        detail["retryDelay"], (api_key, request_text)
                    )
                violations = detail.get("violations")
                if isinstance(violations, list):
                    safe_violations = []
                    for violation in violations:
                        if not isinstance(violation, dict):
                            continue
                        safe_violation: dict[str, Any] = {
                            key: _safe_text(violation[key], (api_key, request_text))
                            for key in ("quotaMetric", "quotaId")
                            if isinstance(violation.get(key), str)
                        }
                        dimensions = violation.get("quotaDimensions")
                        if isinstance(dimensions, dict):
                            safe_violation["quotaDimensions"] = {
                                key: _safe_text(value, (api_key, request_text))
                                for key, value in dimensions.items()
                                if key in {"model", "location"} and isinstance(value, str)
                            }
                        if safe_violation:
                            safe_violations.append(safe_violation)
                    if safe_violations:
                        safe_detail["violations"] = safe_violations
                if safe_detail:
                    safe_details.append(safe_detail)
        if safe_details:
            summary["details"] = safe_details
        return summary

    body_text = response.text.strip()
    if body_text:
        summary["message"] = _safe_text(body_text, (api_key, request_text))
    return summary


def _retry_after_seconds(response: httpx.Response) -> float:
    retry_after = response.headers.get("Retry-After")
    if not retry_after:
        try:
            body = response.json()
        except ValueError:
            body = None
        error = body.get("error") if isinstance(body, dict) else None
        details = error.get("details") if isinstance(error, dict) else None
        if isinstance(details, list):
            for detail in details:
                if isinstance(detail, dict) and isinstance(detail.get("retryDelay"), str):
                    match = re.fullmatch(r"(\d+(?:\.\d+)?)s", detail["retryDelay"])
                    if match:
                        retry_after = match.group(1)
                        break
    if retry_after:
        try:
            seconds = float(retry_after)
        except ValueError:
            try:
                retry_time = parsedate_to_datetime(retry_after)
                if retry_time.tzinfo is None:
                    retry_time = retry_time.replace(tzinfo=UTC)
                seconds = (retry_time - datetime.now(UTC)).total_seconds()
            except (TypeError, ValueError, OverflowError):
                seconds = _DEFAULT_429_COOLDOWN_SECONDS
    else:
        seconds = _DEFAULT_429_COOLDOWN_SECONDS
    return min(max(seconds, 1.0), _MAX_429_COOLDOWN_SECONDS)


class GeminiTTSProvider(TTSProvider):
    """Calls Gemini TTS and returns validated WAV audio for browser playback."""

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-3.8-flash-lite-tts",
        voice_id: str = "Aoede",
        timeout: float = 30.0,
    ):
        if timeout <= 0:
            raise ValueError("TTS timeout must be greater than zero")
        self._api_key = api_key
        self._model = model
        self._voice_id = voice_id
        self._timeout = timeout

    def _models_to_try(self) -> list[str]:
        fallback = next((model for model in _FALLBACK_MODELS if model != self._model), None)
        return [self._model, *([fallback] if fallback else [])]

    def _audio_result(self, data: Any, model_name: str) -> AudioResult:
        try:
            parts = data["candidates"][0]["content"]["parts"]
            inline_data = next(part["inlineData"] for part in parts if "inlineData" in part)
            encoded_audio = inline_data["data"]
            mime_type = inline_data.get("mimeType", "")
        except (KeyError, IndexError, StopIteration, TypeError) as exc:
            raise ValueError("Gemini response did not contain audio data") from exc

        if not isinstance(encoded_audio, str) or not encoded_audio:
            raise ValueError("Gemini returned empty audio data")
        try:
            audio_bytes = base64.b64decode(encoded_audio, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("Gemini returned invalid base64 audio") from exc
        if not audio_bytes:
            raise ValueError("Gemini returned empty audio data")

        normalized_mime = mime_type.lower()
        if normalized_mime.startswith("audio/wav") or audio_bytes.startswith(b"RIFF"):
            sample_rate, duration = _inspect_wav(audio_bytes)
            return AudioResult(
                audio_bytes=audio_bytes,
                mime_type="audio/wav",
                sample_rate=sample_rate,
                duration_seconds=duration,
            )

        is_legacy_model = model_name == "gemini-3.1-flash-tts-preview"
        if normalized_mime.startswith("audio/l16") or (not normalized_mime and is_legacy_model):
            rate_match = re.search(r"(?:^|;)rate=(\d+)", normalized_mime)
            sample_rate = int(rate_match.group(1)) if rate_match else 24000
            wav_bytes = _pcm_to_wav(audio_bytes, sample_rate=sample_rate)
            actual_sample_rate, duration = _inspect_wav(wav_bytes)
            return AudioResult(
                audio_bytes=wav_bytes,
                mime_type="audio/wav",
                sample_rate=actual_sample_rate,
                duration_seconds=duration,
            )

        raise ValueError("Gemini returned an unsupported audio format")

    async def synthesize(
        self,
        text: str,
        voice_id: str | None = None,
    ) -> AudioResult:
        if not text.strip():
            raise ValueError("TTS input text must not be empty")

        voice = voice_id or self._voice_id
        payload = {
            "contents": [{"parts": [{"text": text}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {"voiceName": voice}
                    }
                },
            },
        }

        timeout = httpx.Timeout(self._timeout, connect=min(5.0, self._timeout))
        fatal_auth_error = False
        async with httpx.AsyncClient(timeout=timeout) as client:
            for model_name in self._models_to_try():
                now = time.monotonic()
                cooldown_until = _MODEL_COOLDOWNS.get(model_name, 0.0)
                if cooldown_until > now:
                    logger.info(
                        "Skipping Gemini TTS model %s during provider cooldown",
                        model_name,
                    )
                    continue
                _MODEL_COOLDOWNS.pop(model_name, None)

                url = f"{_GEMINI_BASE}/{model_name}:generateContent"
                for attempt in range(_MAX_ATTEMPTS_PER_MODEL):
                    try:
                        response = await client.post(
                            url,
                            headers={"x-goog-api-key": self._api_key},
                            json=payload,
                        )
                    except httpx.RequestError as exc:
                        logger.warning(
                            "Gemini TTS transport failure model=%s attempt=%s error_type=%s",
                            model_name,
                            attempt + 1,
                            type(exc).__name__,
                        )
                        if attempt + 1 < _MAX_ATTEMPTS_PER_MODEL:
                            await asyncio.sleep(_BACKOFF_SECONDS * (2**attempt))
                            continue
                        _MODEL_COOLDOWNS[model_name] = (
                            time.monotonic() + _TRANSIENT_COOLDOWN_SECONDS
                        )
                        break

                    if response.status_code == 200:
                        try:
                            return self._audio_result(response.json(), model_name)
                        except (ValueError, TypeError) as exc:
                            logger.warning(
                                "Gemini TTS returned unusable audio model=%s reason=%s",
                                model_name,
                                str(exc),
                            )
                            _MODEL_COOLDOWNS[model_name] = (
                                time.monotonic() + _TRANSIENT_COOLDOWN_SECONDS
                            )
                            break

                    error_summary = _safe_error_summary(
                        response,
                        self._api_key,
                        text,
                    )
                    if response.status_code == 429:
                        cooldown = _retry_after_seconds(response)
                        _MODEL_COOLDOWNS[model_name] = time.monotonic() + cooldown
                        error_text = json.dumps(error_summary, ensure_ascii=True)
                        lowered_error = error_text.lower()
                        if "quota" in lowered_error:
                            category = "quota_or_model_limit"
                        elif "rate" in lowered_error:
                            category = "rate_limit"
                        else:
                            category = "provider_throttled"
                        logger.warning(
                            "Gemini TTS HTTP 429 model=%s category=%s cooldown_seconds=%.0f "
                            "provider_error=%s",
                            model_name,
                            category,
                            cooldown,
                            error_text,
                        )
                        break

                    if response.status_code in (401, 403):
                        logger.error(
                            "Gemini TTS authorization rejected model=%s provider_error=%s",
                            model_name,
                            json.dumps(error_summary, ensure_ascii=True),
                        )
                        fatal_auth_error = True
                        break

                    if response.status_code >= 500:
                        logger.warning(
                            "Gemini TTS server error model=%s attempt=%s provider_error=%s",
                            model_name,
                            attempt + 1,
                            json.dumps(error_summary, ensure_ascii=True),
                        )
                        if response.headers.get("Retry-After"):
                            _MODEL_COOLDOWNS[model_name] = (
                                time.monotonic() + _retry_after_seconds(response)
                            )
                            break
                        if attempt + 1 < _MAX_ATTEMPTS_PER_MODEL:
                            await asyncio.sleep(_BACKOFF_SECONDS * (2**attempt))
                            continue
                        _MODEL_COOLDOWNS[model_name] = (
                            time.monotonic() + _TRANSIENT_COOLDOWN_SECONDS
                        )
                        break

                    logger.warning(
                        "Gemini TTS request rejected model=%s provider_error=%s",
                        model_name,
                        json.dumps(error_summary, ensure_ascii=True),
                    )
                    break

                if fatal_auth_error:
                    break

        raise RuntimeError("Gemini TTS failed for the configured model and fallback")

    async def health_check(self) -> bool:
        try:
            result = await self.synthesize("OK")
            return len(result.audio_bytes) > 44
        except Exception as exc:
            logger.warning("Gemini TTS health check failed: %s", type(exc).__name__)
            return False
