import asyncio
from app.providers import get_llm_provider, get_tts_provider, get_stt_provider

async def main():
    print("Testing LLM...")
    llm = get_llm_provider()
    llm_resp = await llm.generate("Say hello!")
    print(f"LLM Response: {llm_resp.text.strip()}")

    print("\nTesting TTS...")
    tts = get_tts_provider()
    audio = await tts.synthesize("Welcome to your interview with Aarohi.")
    print(f"TTS Audio generated: {len(audio.audio_bytes)} bytes WAV")

    print("\nTesting STT (health)...")
    stt = get_stt_provider()
    stt_health = await stt.health_check()
    print(f"STT Health check: {stt_health}")

    print("\nALL PROVIDERS VERIFIED WORKING!")

if __name__ == "__main__":
    asyncio.run(main())
