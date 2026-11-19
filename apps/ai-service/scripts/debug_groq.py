import asyncio
import io
import httpx
from app.config.settings import get_settings

settings = get_settings()
print(f"STT Model: {settings.stt.model}")
print(f"STT Config Language: {settings.stt.language}")
print(f"STT Key prefix: {settings.stt.groq_api_key[:8]}...")

async def test_groq():
    api_key = settings.stt.groq_api_key
    url = "https://api.groq.com/openai/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {api_key}"}

    # Test 1: Language en-IN vs en with dummy/minimal audio
    # Let's create a minimal valid WAV header (44 bytes)
    import wave
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        # Write 0.5 sec of silence
        wav.writeframes(b'\x00\x00' * 8000)
    wav_bytes = buf.getvalue()

    for lang in ["en-IN", "en", None]:
        print(f"\n--- Testing language={lang} ---")
        data = {
            "model": settings.stt.model,
            "response_format": "verbose_json",
        }
        if lang:
            data["language"] = lang

        files = {"file": ("audio.wav", io.BytesIO(wav_bytes), "audio/wav")}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, headers=headers, files=files, data=data)
                print(f"Status: {resp.status_code}")
                print(f"Response: {resp.text}")
        except Exception as e:
            print(f"Exception: {e}")

if __name__ == "__main__":
    asyncio.run(test_groq())
