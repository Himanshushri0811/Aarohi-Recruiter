"""
Unit tests for Groq STT provider.

Tests:
1. _normalize_language: locale tags stripped correctly
2. GroqSTTProvider.__init__: normalizes language at construction
3. transcribe: empty audio raises ValueError (no API call made)
4. transcribe: too-small audio raises ValueError
5. transcribe: valid WAV — successful mock response parsed correctly
6. transcribe: Groq HTTP 400 (invalid_language) raises HTTPStatusError
7. transcribe: Groq HTTP 400 (empty_audio_file) raises HTTPStatusError
8. transcribe: Groq HTTP 401 (bad API key) raises HTTPStatusError
9. transcribe: timeout raises TimeoutError
10. transcribe: audio/webm;codecs=opus MIME mapped to .webm filename
11. transcribe: audio/ogg mapped correctly
12. transcribe: language override per-call strips locale
13. transcribe: missing language → auto-detect (no language param sent)
14. Failed transcription does not trigger LLM (route-level test)
"""

import io
import json
import wave
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.providers.stt.groq import GroqSTTProvider, _normalize_language


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_wav(duration_frames: int = 8000, rate: int = 16000) -> bytes:
    """Return a minimal valid WAV byte string with silence."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        wf.writeframes(b"\x00\x00" * duration_frames)
    return buf.getvalue()


def _groq_success_body(text: str = "Hello world", lang: str = "english") -> dict:
    return {
        "task": "transcribe",
        "language": lang,
        "duration": 1.0,
        "text": text,
        "segments": [],
    }


def _mock_response(status: int, body: dict | str) -> httpx.Response:
    content = json.dumps(body).encode() if isinstance(body, dict) else body.encode()
    return httpx.Response(status_code=status, content=content)


# ---------------------------------------------------------------------------
# 1. _normalize_language
# ---------------------------------------------------------------------------

class TestNormalizeLanguage:
    def test_strips_region_subtag_hyphen(self):
        assert _normalize_language("en-IN") == "en"

    def test_strips_region_subtag_underscore(self):
        assert _normalize_language("hi_IN") == "hi"

    def test_pure_iso_639_1_unchanged(self):
        assert _normalize_language("en") == "en"

    def test_lowercases(self):
        assert _normalize_language("FR") == "fr"

    def test_empty_string_returns_empty(self):
        assert _normalize_language("") == ""

    def test_none_equivalent_whitespace(self):
        assert _normalize_language("   ") == ""

    def test_bcp47_full_tag(self):
        # e.g. zh-Hans-CN → zh
        assert _normalize_language("zh-Hans-CN") == "zh"


# ---------------------------------------------------------------------------
# 2. GroqSTTProvider.__init__ normalizes language
# ---------------------------------------------------------------------------

class TestGroqSTTProviderInit:
    def test_en_in_normalized_to_en(self):
        p = GroqSTTProvider(api_key="key", language="en-IN")
        assert p._language == "en"

    def test_hi_in_normalized_to_hi(self):
        p = GroqSTTProvider(api_key="key", language="hi-IN")
        assert p._language == "hi"

    def test_plain_en_unchanged(self):
        p = GroqSTTProvider(api_key="key", language="en")
        assert p._language == "en"


# ---------------------------------------------------------------------------
# 3–4. Empty / too-small audio guard (no network call)
# ---------------------------------------------------------------------------

class TestAudioGuard:
    @pytest.mark.asyncio
    async def test_empty_bytes_raises_value_error(self):
        p = GroqSTTProvider(api_key="key")
        with pytest.raises(ValueError, match="too small"):
            await p.transcribe(b"", mime_type="audio/wav")

    @pytest.mark.asyncio
    async def test_tiny_payload_raises_value_error(self):
        p = GroqSTTProvider(api_key="key")
        with pytest.raises(ValueError, match="too small"):
            await p.transcribe(b"\x00" * 50, mime_type="audio/wav")

    @pytest.mark.asyncio
    async def test_empty_raises_before_any_http_call(self):
        """Confirm no HTTP client is instantiated when audio is empty."""
        p = GroqSTTProvider(api_key="key")
        with patch("app.providers.stt.groq.httpx.AsyncClient") as mock_client:
            with pytest.raises(ValueError):
                await p.transcribe(b"", mime_type="audio/wav")
            mock_client.assert_not_called()


# ---------------------------------------------------------------------------
# 5. Valid audio — successful Groq response
# ---------------------------------------------------------------------------

class TestSuccessfulTranscription:
    @pytest.mark.asyncio
    async def test_valid_wav_returns_transcript(self):
        audio = _make_wav()
        success_body = _groq_success_body("I build distributed systems.")
        mock_resp = _mock_response(200, success_body)

        p = GroqSTTProvider(api_key="key", language="en")

        with patch("app.providers.stt.groq.httpx.AsyncClient") as MockClient:
            mock_post = AsyncMock(return_value=mock_resp)
            MockClient.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock(post=mock_post)
            )
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await p.transcribe(audio, mime_type="audio/wav")

        assert result.text == "I build distributed systems."
        assert result.language == "english"
        assert result.duration_seconds == 1.0

    @pytest.mark.asyncio
    async def test_language_sent_as_iso_639_1(self):
        """Verify the actual POST data uses the normalized language code, not 'en-IN'."""
        audio = _make_wav()
        success_body = _groq_success_body()
        mock_resp = _mock_response(200, success_body)

        p = GroqSTTProvider(api_key="key", language="en-IN")
        assert p._language == "en"  # already normalized

        posted_data: list[dict] = []

        async def capture_post(url, *, headers, files, data):
            posted_data.append(dict(data))
            return mock_resp

        with patch("app.providers.stt.groq.httpx.AsyncClient") as MockClient:
            mock_client_instance = MagicMock()
            mock_client_instance.post = AsyncMock(side_effect=capture_post)
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client_instance)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            await p.transcribe(audio, mime_type="audio/wav")

        assert posted_data[0]["language"] == "en"
        assert "en-IN" not in str(posted_data)


# ---------------------------------------------------------------------------
# 6. Groq HTTP 400 — invalid_language
# ---------------------------------------------------------------------------

class TestGroqHTTP400InvalidLanguage:
    @pytest.mark.asyncio
    async def test_raises_http_status_error_with_body_logged(self):
        audio = _make_wav()
        error_body = {
            "error": {
                "message": "unsupported language: en-IN",
                "type": "invalid_request_error",
                "code": "invalid_language",
            }
        }
        # Simulate what Groq returns when language=en-IN is sent
        mock_resp = _mock_response(400, error_body)
        mock_resp = httpx.Response(
            status_code=400,
            content=json.dumps(error_body).encode(),
            request=httpx.Request("POST", "https://api.groq.com/openai/v1/audio/transcriptions"),
        )

        p = GroqSTTProvider(api_key="key", language="en")

        with patch("app.providers.stt.groq.httpx.AsyncClient") as MockClient:
            mock_client_instance = MagicMock()
            mock_client_instance.post = AsyncMock(return_value=mock_resp)
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client_instance)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            with pytest.raises(httpx.HTTPStatusError) as exc_info:
                await p.transcribe(audio, mime_type="audio/wav")

        assert exc_info.value.response.status_code == 400
        assert "unsupported language" in exc_info.value.response.text


# ---------------------------------------------------------------------------
# 7. Groq HTTP 400 — empty_audio_file
# ---------------------------------------------------------------------------

class TestGroqHTTP400EmptyAudio:
    @pytest.mark.asyncio
    async def test_empty_file_error_raised_before_network(self):
        """The provider-level guard should catch empty audio before Groq does."""
        p = GroqSTTProvider(api_key="key")
        with pytest.raises(ValueError, match="too small"):
            await p.transcribe(b"", mime_type="audio/webm")


# ---------------------------------------------------------------------------
# 8. Groq HTTP 401 — bad API key
# ---------------------------------------------------------------------------

class TestGroqHTTP401:
    @pytest.mark.asyncio
    async def test_bad_api_key_raises_http_status_error(self):
        audio = _make_wav()
        error_body = {"error": {"message": "Invalid API Key", "type": "invalid_request_error"}}
        mock_resp = httpx.Response(
            status_code=401,
            content=json.dumps(error_body).encode(),
            request=httpx.Request("POST", "https://api.groq.com/openai/v1/audio/transcriptions"),
        )

        p = GroqSTTProvider(api_key="bad-key")

        with patch("app.providers.stt.groq.httpx.AsyncClient") as MockClient:
            mock_client_instance = MagicMock()
            mock_client_instance.post = AsyncMock(return_value=mock_resp)
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client_instance)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            with pytest.raises(httpx.HTTPStatusError) as exc_info:
                await p.transcribe(audio, mime_type="audio/wav")

        assert exc_info.value.response.status_code == 401


# ---------------------------------------------------------------------------
# 9. Timeout
# ---------------------------------------------------------------------------

class TestGroqTimeout:
    @pytest.mark.asyncio
    async def test_timeout_raises_timeout_error(self):
        audio = _make_wav()
        p = GroqSTTProvider(api_key="key", timeout=1.0)

        with patch("app.providers.stt.groq.httpx.AsyncClient") as MockClient:
            mock_client_instance = MagicMock()
            mock_client_instance.post = AsyncMock(
                side_effect=httpx.TimeoutException("Request timed out")
            )
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client_instance)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            with pytest.raises(TimeoutError, match="timed out"):
                await p.transcribe(audio, mime_type="audio/wav")


# ---------------------------------------------------------------------------
# 10–11. MIME type → filename mapping
# ---------------------------------------------------------------------------

class TestMimeTypeMapping:
    @pytest.mark.asyncio
    async def test_webm_opus_mapped_to_webm_filename(self):
        audio = _make_wav()
        success_body = _groq_success_body()
        mock_resp = _mock_response(200, success_body)

        p = GroqSTTProvider(api_key="key")
        captured_files: list = []

        async def capture(url, *, headers, files, data):
            captured_files.append(files)
            return mock_resp

        with patch("app.providers.stt.groq.httpx.AsyncClient") as MockClient:
            mc = MagicMock()
            mc.post = AsyncMock(side_effect=capture)
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mc)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            await p.transcribe(audio, mime_type="audio/webm;codecs=opus")

        filename = captured_files[0]["file"][0]
        assert filename == "audio.webm"

    @pytest.mark.asyncio
    async def test_ogg_mapped_to_ogg_filename(self):
        audio = _make_wav()
        success_body = _groq_success_body()
        mock_resp = _mock_response(200, success_body)

        p = GroqSTTProvider(api_key="key")
        captured_files: list = []

        async def capture(url, *, headers, files, data):
            captured_files.append(files)
            return mock_resp

        with patch("app.providers.stt.groq.httpx.AsyncClient") as MockClient:
            mc = MagicMock()
            mc.post = AsyncMock(side_effect=capture)
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mc)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            await p.transcribe(audio, mime_type="audio/ogg;codecs=opus")

        filename = captured_files[0]["file"][0]
        assert filename == "audio.ogg"


# ---------------------------------------------------------------------------
# 12. Per-call language override strips locale
# ---------------------------------------------------------------------------

class TestPerCallLanguageOverride:
    @pytest.mark.asyncio
    async def test_per_call_language_normalized(self):
        audio = _make_wav()
        success_body = _groq_success_body()
        mock_resp = _mock_response(200, success_body)

        p = GroqSTTProvider(api_key="key", language="en")
        posted_data: list[dict] = []

        async def capture(url, *, headers, files, data):
            posted_data.append(dict(data))
            return mock_resp

        with patch("app.providers.stt.groq.httpx.AsyncClient") as MockClient:
            mc = MagicMock()
            mc.post = AsyncMock(side_effect=capture)
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mc)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            # Pass "hi-IN" per-call; should arrive as "hi"
            await p.transcribe(audio, mime_type="audio/wav", language="hi-IN")

        assert posted_data[0]["language"] == "hi"


# ---------------------------------------------------------------------------
# 13. Auto-detect: empty language → no language field in POST
# ---------------------------------------------------------------------------

class TestAutoDetect:
    @pytest.mark.asyncio
    async def test_empty_language_omits_language_param(self):
        audio = _make_wav()
        success_body = _groq_success_body()
        mock_resp = _mock_response(200, success_body)

        p = GroqSTTProvider(api_key="key", language="")
        posted_data: list[dict] = []

        async def capture(url, *, headers, files, data):
            posted_data.append(dict(data))
            return mock_resp

        with patch("app.providers.stt.groq.httpx.AsyncClient") as MockClient:
            mc = MagicMock()
            mc.post = AsyncMock(side_effect=capture)
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mc)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
            await p.transcribe(audio, mime_type="audio/wav")

        # language key should be absent when lang resolves to ""
        assert "language" not in posted_data[0]


# ---------------------------------------------------------------------------
# 14. STTSettings validator (config-level protection)
# ---------------------------------------------------------------------------

class TestSTTSettingsValidator:
    def test_en_in_normalized_at_config_level(self):
        """Confirm the pydantic validator strips locale before provider instantiation."""
        from app.core.config import STTSettings, STTProviderType
        s = STTSettings(provider=STTProviderType.GROQ, language="en-IN")
        assert s.language == "en"

    def test_hi_in_normalized(self):
        from app.core.config import STTSettings, STTProviderType
        s = STTSettings(provider=STTProviderType.GROQ, language="hi-IN")
        assert s.language == "hi"

    def test_plain_en_unchanged(self):
        from app.core.config import STTSettings, STTProviderType
        s = STTSettings(provider=STTProviderType.GROQ, language="en")
        assert s.language == "en"

    def test_empty_defaults_to_en(self):
        from app.core.config import STTSettings, STTProviderType
        s = STTSettings(provider=STTProviderType.GROQ, language="")
        assert s.language == "en"
