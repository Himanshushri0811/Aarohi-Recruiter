import pytest

from app.core.security import create_service_token


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        (
            "/api/v1/interview/start",
            {"interviewId": "interview-1"},
        ),
        (
            "/api/v1/interview/answer",
            {
                "interviewId": "interview-1",
                "questionText": "Tell me about yourself",
                "audioBase64": "YQ==",
            },
        ),
    ],
)
def test_candidate_ai_routes_require_service_authentication(test_client, path, payload):
    response = test_client.post(path, json=payload)

    assert response.status_code == 401


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        (
            "/api/v1/interview/start",
            {"interviewId": "another-interview"},
        ),
        (
            "/api/v1/interview/answer",
            {
                "interviewId": "another-interview",
                "questionText": "Tell me about yourself",
                "audioBase64": "YQ==",
            },
        ),
    ],
)
def test_candidate_ai_routes_reject_tokens_for_other_interviews(
    test_client, path, payload
):
    token = create_service_token(org_id="org-1", interview_id="interview-1")

    response = test_client.post(
        path,
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403


def test_candidate_ai_routes_reject_tokens_without_conduct_scope(test_client):
    token = create_service_token(
        org_id="org-1",
        interview_id="interview-1",
        scopes=["interview:read"],
    )

    response = test_client.post(
        "/api/v1/interview/start",
        json={"interviewId": "interview-1"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
