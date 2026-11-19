import base64
import io
import wave

import pytest

from app.core.security import create_service_token
from app.providers.llm.mock import MockLLMProvider
from app.providers.stt.mock import MockSTTProvider
from app.providers.tts.mock import MockTTSProvider


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        (
            "/api/v1/interview/start",
            {"interviewId": "interview-1", "candidateName": "Candidate"},
        ),
        (
            "/api/v1/interview/answer",
            {
                "interviewId": "interview-1",
                "questionId": "greeting",
                "questionText": "Welcome",
                "questionNumber": 1,
                "audioBase64": "YQ==",
            },
        ),
    ],
)
def test_interview_endpoints_return_frontend_compatible_wav(
    test_client, monkeypatch, path, payload
):
    monkeypatch.setattr(
        "app.api.routes.interview.get_tts_provider",
        MockTTSProvider,
    )
    monkeypatch.setattr(
        "app.api.routes.interview.get_stt_provider",
        MockSTTProvider,
    )
    monkeypatch.setattr(
        "app.api.routes.interview.get_llm_provider",
        MockLLMProvider,
    )
    token = create_service_token(
        org_id="org-1",
        interview_id="interview-1",
        scopes=["interview:conduct"],
    )

    response = test_client.post(
        path,
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    audio_bytes = base64.b64decode(response.json()["audioBase64"], validate=True)
    assert audio_bytes.startswith(b"RIFF")
    assert audio_bytes[8:12] == b"WAVE"
    with wave.open(io.BytesIO(audio_bytes), "rb") as wav:
        assert wav.getframerate() == 24000
        assert wav.getnframes() > 0
