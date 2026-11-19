import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.providers import get_llm_provider, get_stt_provider, get_tts_provider
from app.api.routes.interview import _build_contextual_follow_up_prompt, _AAROHI_PERSONA
import json

async def run_end_to_end_test():
    print("=== Step 1: Synthesize candidate speech using Gemini TTS ===")
    tts = get_tts_provider()
    candidate_phrase = "I am a software engineer with four years of experience building distributed systems in Python and TypeScript."
    tts_res = await tts.synthesize(candidate_phrase)
    audio_bytes = tts_res.audio_bytes
    print(f"Candidate audio generated: {len(audio_bytes)} bytes WAV")

    print("\n=== Step 2: Transcribe candidate speech using Groq STT ===")
    stt = get_stt_provider()
    stt_res = await stt.transcribe(audio_bytes, mime_type="audio/wav", language="en")
    print(f"Groq Transcript: \"{stt_res.text}\"")
    print(f"Detected Language: {stt_res.language}")
    print(f"Duration: {stt_res.duration_seconds}s")

    assert len(stt_res.text) > 0, "Transcription should not be empty"

    print("\n=== Step 3: Generate Aarohi follow-up using Gemini LLM ===")
    llm = get_llm_provider()
    prompt = _build_contextual_follow_up_prompt(
        candidate_name="Himanshu",
        job_title="Senior Backend Engineer",
        job_desc="Building scalable microservices with Python and distributed databases.",
        resume_summary="Experienced software engineer with focus on backend systems.",
        skills=["Python", "Distributed Systems", "TypeScript"],
        last_question="Could you please tell me about yourself and your background?",
        transcript=stt_res.text,
        history=[],
        question_number=2,
        total_questions=5,
    )
    llm_res = await llm.generate(prompt=prompt, system=_AAROHI_PERSONA, response_json=True)
    raw = llm_res.text.strip().lstrip("```json").lstrip("```").rstrip("```")
    data = json.loads(raw)
    next_q = data.get("nextQuestion")
    print(f"Aarohi Contextual Response: \"{next_q}\"")

    print("\n=== Step 4: Synthesize Aarohi response audio ===")
    aarohi_audio = await tts.synthesize(next_q)
    print(f"Aarohi Spoken Audio generated: {len(aarohi_audio.audio_bytes)} bytes WAV")

    print("\n=== SUCCESS: Real audio-to-transcript-to-Aarohi-response pipeline fully verified! ===")

if __name__ == "__main__":
    asyncio.run(run_end_to_end_test())
