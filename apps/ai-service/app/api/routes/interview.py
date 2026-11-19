"""
Interview conversation engine route.

Follows the required Aarohi voice conversation journey:
Greeting:
"Hello! Welcome to your interview. My name is Aarohi, and I'll be conducting your interview today. How are you doing?"
Turn 1: Candidate responds -> Aarohi: "That's great. Let's get started. Could you please tell me about yourself?"
Turn 2: Candidate answers "Tell me about yourself" -> Groq STT transcribes -> Gemini generates context-aware follow-up -> Gemini TTS synthesizes audio.
"""

import base64
import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.dependencies.auth import get_authenticated_service_token
from app.core.security import ServiceTokenClaims, assert_tenant_authorization
from app.providers import get_llm_provider, get_stt_provider, get_tts_provider

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/interview", tags=["Interview Engine"])
AuthenticatedServiceToken = Annotated[
    ServiceTokenClaims,
    Depends(get_authenticated_service_token),
]


def _authorize_interview_request(claims: ServiceTokenClaims, interview_id: str) -> None:
    assert_tenant_authorization(claims, claims.org_id, interview_id)
    if "interview:conduct" not in claims.scopes:
        raise HTTPException(status_code=403, detail="Service token lacks interview conduct scope")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class StartInterviewRequest(BaseModel):
    interviewId: str
    candidateName: str = "Candidate"
    jobTitle: str = "Software Engineer"
    jobDescription: str | None = None
    resumeText: str | None = None
    language: str = "en"
    instructions: str | None = None


class StartInterviewResponse(BaseModel):
    greeting: str
    firstQuestion: str
    audioBase64: str  # WAV audio, base64 encoded
    questionId: str = "greeting"


class AnswerRequest(BaseModel):
    interviewId: str
    questionId: str = "q-1"
    questionText: str
    questionNumber: int = 1
    totalQuestions: int = 6
    audioBase64: str  # Candidate's audio, base64 encoded
    mimeType: str = "audio/webm"
    history: list[dict] = Field(default_factory=list)
    candidateName: str = "Candidate"
    jobTitle: str = ""
    jobDescription: str | None = None
    resumeSummary: str | None = None
    technicalSkills: list[str] = Field(default_factory=list)
    language: str = "en"


class AnswerResponse(BaseModel):
    transcript: str
    nextQuestion: str | None = None
    audioBase64: str | None = None  # WAV base64
    interviewComplete: bool = False
    followUp: str | None = None


class EvaluateRequest(BaseModel):
    interviewId: str
    jobTitle: str
    jobDescription: str | None = None
    resumeText: str | None = None
    transcript: list[dict]  # [{question, answer, questionNumber}]
    language: str = "en"


class EvaluationReport(BaseModel):
    overallScore: float
    recommendation: str  # STRONG_HIRE | HIRE | CONSIDER | NO_HIRE
    summary: str
    rubricScores: dict
    strengths: list[str]
    weaknesses: list[str]
    areasToClarify: list[str]


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

_AAROHI_PERSONA = """You are Aarohi, an empathetic, professional AI technical recruiter and interviewer.
You are conducting a live voice-based recruitment interview.
You speak clearly, warmly, and concisely. Keep responses spoken, conversational, and natural (1-3 sentences).
Do NOT use bullet points, markdown bolding, or lists in your spoken responses.
NEVER evaluate accent, ethnicity, gender, appearance, or protected traits.
Focus solely on technical knowledge, problem-solving, and role-relevant experience."""


def _build_contextual_follow_up_prompt(
    candidate_name: str,
    job_title: str,
    job_desc: str | None,
    resume_summary: str | None,
    skills: list[str],
    last_question: str,
    transcript: str,
    history: list[dict],
    question_number: int,
    total_questions: int,
) -> str:
    history_lines = []
    for h in history[-3:]:
        history_lines.append(f"Q: {h.get('question')}\nA: {h.get('answer')}")
    history_str = "\n".join(history_lines)

    is_final = question_number >= total_questions

    if is_final:
        return f"""The candidate has just answered: "{transcript}"
This is the end of the interview. Generate a polite, warm spoken closing thanking {candidate_name} and letting them know the recruiting team will be in touch with next steps.

Return JSON:
{{
  "nextQuestion": "Thank you for your time today, {candidate_name}. You've done great, and our hiring team will follow up with you soon. Have a wonderful day!",
  "isClosing": true
}}"""

    return f"""Interview Context:
- Candidate: {candidate_name}
- Target Job: {job_title}
- Job Requirements: {job_desc[:600] if job_desc else 'Not specified'}
- Candidate Resume Background: {resume_summary[:600] if resume_summary else 'Technical candidate'}
- Key Skills: {', '.join(skills[:8]) if skills else 'Software Development'}

Interview History:
{history_str}

Last Question Asked: {last_question}
Candidate's Spoken Answer: "{transcript}"

Task:
1. Briefly acknowledge their response in one conversational sentence (e.g., "That sounds like valuable experience with [technology].").
2. Ask ONE relevant follow-up question that probes deeper into their hands-on experience, architecture decisions, or problem-solving relevant to the {job_title} role.
3. Keep the entire response under 50 words so it sounds natural when spoken aloud.

Return JSON:
{{
  "acknowledgment": "Brief acknowledgement",
  "nextQuestion": "Acknowledging sentence + The single follow-up question",
  "isClosing": false
}}"""


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/start", response_model=StartInterviewResponse)
async def start_interview(
    request: StartInterviewRequest,
    claims: AuthenticatedServiceToken,
) -> StartInterviewResponse:
    """
    Begins the interview with Aarohi's canonical opening greeting:
    "Hello! Welcome to your interview. My name is Aarohi, and I'll be conducting your interview today. How are you doing?"
    """
    _authorize_interview_request(claims, request.interviewId)

    tts = get_tts_provider()
    greeting = (
        f"Hello {request.candidateName}! Welcome to your interview. "
        "My name is Aarohi, and I'll be conducting your interview today. How are you doing?"
    )

    try:
        audio_res = await tts.synthesize(greeting)
        audio_b64 = base64.b64encode(audio_res.audio_bytes).decode()
    except Exception as e:
        logger.warning("TTS generation for greeting failed: %s", e)
        audio_b64 = ""

    return StartInterviewResponse(
        greeting=greeting,
        firstQuestion=greeting,
        audioBase64=audio_b64,
        questionId="greeting",
    )


@router.post("/answer", response_model=AnswerResponse)
async def process_answer(
    request: AnswerRequest,
    claims: AuthenticatedServiceToken,
) -> AnswerResponse:
    """
    Candidate answer processing pipeline:
    1. Transcribe audio using Groq Whisper.
    2. Branch conversation flow:
       - If answering greeting -> Aarohi transitions: "That's great. Let's get started. Could you please tell me about yourself?"
       - If answering "Tell me about yourself" or subsequent questions -> Gemini creates intelligent follow-up.
    3. Synthesize voice with Gemini TTS.
    """
    _authorize_interview_request(claims, request.interviewId)

    stt = get_stt_provider()
    llm = get_llm_provider()
    tts = get_tts_provider()

    # 1. Transcribe audio
    try:
        audio_bytes = base64.b64decode(request.audioBase64)
        if not audio_bytes:
            raise ValueError("Decoded audio payload is empty. The candidate recording may not have captured any data.")
        transcription = await stt.transcribe(audio_bytes, mime_type=request.mimeType, language=request.language or None)
        transcript = transcription.text.strip()
    except ValueError as e:
        logger.warning("STT pre-flight validation failed: %s", e)
        raise HTTPException(status_code=422, detail=str(e))
    except TimeoutError as e:
        logger.error("STT transcription timed out: %s", e)
        raise HTTPException(status_code=504, detail="Speech transcription timed out. Please try again.")
    except Exception as e:
        # Capture Groq HTTP error body when available
        groq_detail = str(e)
        if hasattr(e, "response"):
            try:
                groq_detail = e.response.text  # type: ignore[union-attr]
            except Exception:
                pass
        logger.error("STT transcription failed: %s | Groq response: %s", type(e).__name__, groq_detail)
        raise HTTPException(status_code=502, detail=f"Speech transcription failed: {groq_detail}")

    if not transcript:
        clarification = "I didn't quite catch that. Could you please repeat what you said?"
        try:
            audio_res = await tts.synthesize(clarification)
            audio_b64 = base64.b64encode(audio_res.audio_bytes).decode()
        except Exception:
            audio_b64 = None

        return AnswerResponse(
            transcript="[Silence / Unintelligible]",
            nextQuestion=clarification,
            audioBase64=audio_b64,
            interviewComplete=False,
        )

    # 2. State-driven question progression
    interview_complete = False

    if request.questionId == "greeting" or request.questionNumber == 1:
        # Candidate just answered greeting -> First question: "Tell me about yourself"
        next_question = "That's great. Let's get started. Could you please tell me about yourself and your background?"
    elif "tell me about yourself" in request.questionText.lower() or request.questionNumber == 2:
        # Candidate answered "Tell me about yourself" -> Follow-up using candidate background + job description
        prompt = _build_contextual_follow_up_prompt(
            candidate_name=request.candidateName,
            job_title=request.jobTitle,
            job_desc=request.jobDescription,
            resume_summary=request.resumeSummary,
            skills=request.technicalSkills,
            last_question=request.questionText,
            transcript=transcript,
            history=request.history,
            question_number=request.questionNumber,
            total_questions=request.totalQuestions,
        )
        try:
            llm_res = await llm.generate(prompt=prompt, system=_AAROHI_PERSONA, response_json=True)
            raw = llm_res.text.strip().lstrip("```json").lstrip("```").rstrip("```")
            data = json.loads(raw)
            next_question = data.get("nextQuestion", "Thank you. Could you describe a recent technical project you worked on?")
            interview_complete = data.get("isClosing", False)
        except Exception as e:
            logger.error("Gemini follow-up generation failed: %s", e)
            next_question = "Thank you for sharing that. Could you tell me about the most challenging project you've worked on recently?"
    else:
        # Standard follow-up progression
        prompt = _build_contextual_follow_up_prompt(
            candidate_name=request.candidateName,
            job_title=request.jobTitle,
            job_desc=request.jobDescription,
            resume_summary=request.resumeSummary,
            skills=request.technicalSkills,
            last_question=request.questionText,
            transcript=transcript,
            history=request.history,
            question_number=request.questionNumber,
            total_questions=request.totalQuestions,
        )
        try:
            llm_res = await llm.generate(prompt=prompt, system=_AAROHI_PERSONA, response_json=True)
            raw = llm_res.text.strip().lstrip("```json").lstrip("```").rstrip("```")
            data = json.loads(raw)
            next_question = data.get("nextQuestion", "Thank you. Do you have any questions for me about the role?")
            interview_complete = data.get("isClosing", False)
        except Exception as e:
            logger.error("Gemini follow-up generation failed: %s", e)
            next_question = "Thank you. Could you elaborate on how you collaborate with team members on complex tasks?"

    # 3. Voice synthesis
    try:
        audio_res = await tts.synthesize(next_question)
        audio_b64 = base64.b64encode(audio_res.audio_bytes).decode()
    except Exception as e:
        logger.warning("TTS synthesis failed: %s", e)
        audio_b64 = None

    return AnswerResponse(
        transcript=transcript,
        nextQuestion=next_question,
        audioBase64=audio_b64,
        interviewComplete=interview_complete,
    )
