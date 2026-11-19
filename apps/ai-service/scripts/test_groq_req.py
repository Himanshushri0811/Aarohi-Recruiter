import asyncio
import io
import os
import sys
import wave

# Ensure current directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from app.core.config import get_settings

async def main():
    settings = get_settings()
    api_key = settings.stt.groq_api_key.get_secret_value() if settings.stt.groq_api_key else ""
    print(f"Loaded API key prefix: {api_key[:10]}...")
    print(f"Config language: {settings.stt.language}")
    print(f"Model: {settings.stt.model}")

    # Create 1 second of 16kHz mono audio (silence)
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b'\x00\x00' * 16000)
    audio_bytes = buf.getvalue()

    url = "https://api.groq.com/openai/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {api_key}"}

    test_cases = [
        {"name": "language='en-IN' (Current config)", "lang": "en-IN", "filename": "audio.wav", "content_type": "audio/wav"},
        {"name": "language='en' (ISO-639-1)", "lang": "en", "filename": "audio.wav", "content_type": "audio/wav"},
        {"name": "language=None (auto-detect)", "lang": None, "filename": "audio.wav", "content_type": "audio/wav"},
        {"name": "content_type='audio/webm;codecs=opus'", "lang": "en", "filename": "audio.webm", "content_type": "audio/webm;codecs=opus"},
        {"name": "content_type='audio/webm'", "lang": "en", "filename": "audio.webm", "content_type": "audio/webm"},
        {"name": "Empty audio (0 bytes)", "lang": "en", "filename": "audio.wav", "content_type": "audio/wav", "empty": True},
    ]

    for tc in test_cases:
        print(f"\n>>> Running: {tc['name']}")
        data = {
            "model": settings.stt.model,
            "response_format": "verbose_json",
        }
        if tc.get("lang"):
            data["language"] = tc["lang"]

        payload_bytes = b"" if tc.get("empty") else audio_bytes
        files = {"file": (tc["filename"], io.BytesIO(payload_bytes), tc["content_type"])}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, headers=headers, files=files, data=data)
                print(f"Status Code: {resp.status_code}")
                print(f"Response Body: {resp.text}")
        except Exception as e:
            print(f"Request Exception: {e}")

if __name__ == "__main__":
    asyncio.run(main())
