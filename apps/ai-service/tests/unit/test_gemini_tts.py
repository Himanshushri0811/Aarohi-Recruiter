import base64
import logging

import httpx
import pytest

from app.providers.tts.gemini_tts import GeminiTTSProvider, _pcm_to_wav


def _wav_bytes() -> bytes:
    return _pcm_to_wav(b"\x01\x00" * 2400)


def _success_response(audio_bytes: bytes | None = None, mime_type: str = "audio/wav"):
    encoded = base64.b64encode(audio_bytes if audio_bytes is not None else _wav_bytes()).decode()
    return httpx.Response(
        200,
        json={
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "inlineData": {
                                    "mimeType": mime_type,
                                    "data": encoded,
                                }
                            }
                        ]
                    }
                }
            ]
        },
    )


class FakeAsyncClient:
    def __init__(self, responses, calls):
        self.responses = responses
        self.calls = calls

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_value, traceback):
        return None

    async def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


@pytest.fixture(autouse=True)
def clear_model_cooldowns(monkeypatch):
    monkeypatch.setattr("app.providers.tts.gemini_tts._MODEL_COOLDOWNS", {})


def _use_responses(monkeypatch, responses):
    calls = []

    def create_client(*args, **kwargs):
        return FakeAsyncClient(responses, calls)

    monkeypatch.setattr("app.providers.tts.gemini_tts.httpx.AsyncClient", create_client)
    return calls


@pytest.mark.asyncio
async def test_primary_model_returns_wav_without_wrapping_it_again(monkeypatch):
    audio = _wav_bytes()
    calls = _use_responses(monkeypatch, [_success_response(audio)])
    provider = GeminiTTSProvider(api_key="test-api-key", model="gemini-3.8-flash-tts")

    result = await provider.synthesize("Hello")

    assert result.audio_bytes == audio
    assert result.mime_type == "audio/wav"
    assert result.sample_rate == 24000
    assert result.duration_seconds == pytest.approx(0.1)
    assert calls[0][0].endswith("/gemini-3.8-flash-tts:generateContent")
    assert calls[0][1]["headers"] == {"x-goog-api-key": "test-api-key"}
    assert "test-api-key" not in calls[0][0]


@pytest.mark.asyncio
async def test_primary_429_logs_safe_body_and_falls_back_once(monkeypatch, caplog):
    api_key = "api-key-do-not-log"
    throttle = httpx.Response(
        429,
        headers={"Retry-After": "120"},
        json={
            "error": {
                "code": 429,
                "status": "RESOURCE_EXHAUSTED",
                "message": f"Quota exceeded for {api_key}",
                "details": [
                    {
                        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                        "violations": [
                            {
                                "quotaMetric": "generativelanguage.googleapis.com/generate_requests",
                                "quotaId": "GenerateRequestsPerMinutePerProjectPerModel",
                            }
                        ],
                    }
                ],
            }
        },
    )
    calls = _use_responses(monkeypatch, [throttle, _success_response()])
    provider = GeminiTTSProvider(api_key=api_key, model="gemini-3.8-flash-tts")

    with caplog.at_level(logging.WARNING):
        result = await provider.synthesize("Hello")

    assert result.audio_bytes.startswith(b"RIFF")
    assert len(calls) == 2
    assert calls[1][0].endswith("/gemini-3.8-flash-lite-tts:generateContent")
    assert "RESOURCE_EXHAUSTED" in caplog.text
    assert "GenerateRequestsPerMinutePerProjectPerModel" in caplog.text
    assert api_key not in caplog.text


@pytest.mark.asyncio
async def test_429_cooldown_prevents_repeating_primary_request(monkeypatch):
    primary_throttle = httpx.Response(429, json={"error": {"status": "RESOURCE_EXHAUSTED"}})
    responses = [primary_throttle, _success_response(), _success_response()]
    calls = _use_responses(monkeypatch, responses)
    provider = GeminiTTSProvider(api_key="test-api-key", model="gemini-3.8-flash-tts")

    await provider.synthesize("First")
    next_request_provider = GeminiTTSProvider(
        api_key="test-api-key",
        model="gemini-3.8-flash-tts",
    )
    await next_request_provider.synthesize("Second")

    assert len(calls) == 3
    assert sum("gemini-3.8-flash-tts:generateContent" in call[0] for call in calls) == 1
    assert sum("gemini-3.8-flash-lite-tts:generateContent" in call[0] for call in calls) == 2


@pytest.mark.asyncio
async def test_transient_server_error_retries_once_with_backoff(monkeypatch):
    calls = _use_responses(
        monkeypatch,
        [
            httpx.Response(503, json={"error": {"status": "UNAVAILABLE"}}),
            _success_response(),
        ],
    )
    delays = []

    async def record_sleep(delay):
        delays.append(delay)

    monkeypatch.setattr("app.providers.tts.gemini_tts.asyncio.sleep", record_sleep)
    provider = GeminiTTSProvider(api_key="test-api-key", model="gemini-3.8-flash-tts")

    result = await provider.synthesize("Hello")

    assert result.audio_bytes.startswith(b"RIFF")
    assert len(calls) == 2
    assert delays == [0.25]


@pytest.mark.asyncio
async def test_server_retry_after_uses_fallback_without_immediate_retry(monkeypatch):
    calls = _use_responses(
        monkeypatch,
        [
            httpx.Response(
                503,
                headers={"Retry-After": "60"},
                json={"error": {"status": "UNAVAILABLE"}},
            ),
            _success_response(),
        ],
    )
    delays = []

    async def record_sleep(delay):
        delays.append(delay)

    monkeypatch.setattr("app.providers.tts.gemini_tts.asyncio.sleep", record_sleep)
    provider = GeminiTTSProvider(api_key="test-api-key", model="gemini-3.8-flash-tts")

    result = await provider.synthesize("Hello")

    assert result.audio_bytes.startswith(b"RIFF")
    assert len(calls) == 2
    assert delays == []


@pytest.mark.asyncio
async def test_both_models_failing_raises_without_exposing_provider_details(monkeypatch):
    responses = [
        httpx.Response(429, json={"error": {"status": "RESOURCE_EXHAUSTED"}}),
        httpx.Response(429, json={"error": {"status": "RESOURCE_EXHAUSTED"}}),
    ]
    calls = _use_responses(monkeypatch, responses)
    provider = GeminiTTSProvider(api_key="test-api-key", model="gemini-3.8-flash-tts")

    with pytest.raises(RuntimeError, match="configured model and fallback"):
        await provider.synthesize("Hello")

    assert len(calls) == 2


@pytest.mark.parametrize(
    ("audio_data", "mime_type"),
    [
        (b"", "audio/wav"),
        (b"not a wav file", "audio/wav"),
        (b"\x01", "audio/L16;codec=pcm;rate=24000"),
    ],
)
@pytest.mark.asyncio
async def test_invalid_or_empty_audio_is_rejected(monkeypatch, audio_data, mime_type):
    responses = [
        _success_response(audio_data, mime_type),
        httpx.Response(429, json={"error": {"status": "RESOURCE_EXHAUSTED"}}),
    ]
    calls = _use_responses(monkeypatch, responses)
    provider = GeminiTTSProvider(api_key="test-api-key", model="gemini-3.8-flash-tts")

    with pytest.raises(RuntimeError):
        await provider.synthesize("Hello")

    assert len(calls) == 2


@pytest.mark.asyncio
async def test_legacy_pcm_fallback_is_converted_to_frontend_wav(monkeypatch):
    pcm = b"\x01\x00" * 2400
    responses = [
        httpx.Response(429, json={"error": {"status": "RESOURCE_EXHAUSTED"}}),
        _success_response(pcm, "audio/L16;codec=pcm;rate=24000"),
    ]
    _use_responses(monkeypatch, responses)
    provider = GeminiTTSProvider(
        api_key="test-api-key",
        model="gemini-3.8-flash-lite-tts",
    )

    result = await provider.synthesize("Hello")

    assert result.audio_bytes.startswith(b"RIFF")
    assert result.audio_bytes[8:12] == b"WAVE"
    assert result.mime_type == "audio/wav"
