import json
import os
import subprocess
from pathlib import Path

from app.core.security import create_service_token

ORG_ID = "org-screening-1"
APPLICATION_ID = "application-screening-1"
JOB_DESCRIPTION = "Required skills: Python and AWS. Build secure APIs for customers."
RESUME_TEXT = "Built Python services for customer applications and maintained production APIs."


def _finding(
    title: str,
    status: str,
    summary: str,
    resume_evidence: list[str] | None = None,
    job_evidence: list[str] | None = None,
    confidence: str = "medium",
) -> dict:
    return {
        "title": title,
        "status": status,
        "summary": summary,
        "resumeEvidence": resume_evidence or [],
        "jobEvidence": job_evidence or [],
        "confidence": confidence,
    }


def _report() -> dict:
    return {
        "matchScore": 72,
        "analysisConfidence": "medium",
        "insufficientInformation": False,
        "fitSummary": "The resume contains relevant Python service work, but AWS experience is not evidenced.",
        "requiredSkills": [
            {
                **_finding(
                    "Python",
                    "demonstrated",
                    "Used in service development.",
                    ["Built Python services for customer applications"],
                    ["Required skills: Python and AWS."],
                    "high",
                ),
                "skill": "Python",
            },
            {
                **_finding(
                    "AWS",
                    "not_evidenced",
                    "AWS experience is not evidenced in the supplied resume.",
                    [],
                    ["Required skills: Python and AWS."],
                ),
                "skill": "AWS",
            },
        ],
        "preferredSkills": [],
        "experienceAssessment": _finding(
            "Relevant experience",
            "partial",
            "Relevant service development is described.",
            ["Built Python services for customer applications"],
            ["Build secure APIs for customers."],
        ),
        "projectAssessments": [],
        "educationAssessment": _finding(
            "Education",
            "not_applicable",
            "No education requirement was supplied.",
        ),
        "missingQualifications": [
            _finding(
                "AWS",
                "not_evidenced",
                "AWS is required but not evidenced in this resume.",
                [],
                ["Required skills: Python and AWS."],
            )
        ],
        "strengths": [
            _finding(
                "Service development",
                "demonstrated",
                "Relevant service work is described.",
                ["Built Python services for customer applications"],
                ["Build secure APIs for customers."],
            )
        ],
        "gaps": [],
        "suggestedInterviewTopics": ["Ask about cloud deployment experience."],
    }


class FakeLLM:
    def __init__(self, response_text: str | None = None, error: Exception | None = None):
        self.response_text = response_text or json.dumps(_report())
        self.error = error
        self.prompt = ""

    async def generate(self, *, prompt: str, system: str, response_json: bool):
        _ = (system, response_json)
        self.prompt = prompt
        if self.error:
            raise self.error
        return type("Response", (), {"text": self.response_text})()


def _request_body(resume_text: str = RESUME_TEXT) -> dict:
    return {
        "organizationId": ORG_ID,
        "applicationId": APPLICATION_ID,
        "jobId": "job-screening-1",
        "resumeText": resume_text,
        "parsedResume": {"skills": ["Python"]},
        "jobTitle": "Backend Engineer",
        "jobDescription": JOB_DESCRIPTION,
        "jobSkills": ["Python", "AWS"],
    }


def _token(
    org_id: str = ORG_ID,
    application_id: str = APPLICATION_ID,
    scopes: list[str] | None = None,
) -> str:
    return create_service_token(
        org_id=org_id,
        application_id=application_id,
        scopes=scopes or ["resume:screen"],
    )


def test_resume_analysis_requires_authenticated_scoped_service_token(test_client):
    response = test_client.post("/api/v1/resume/analyze", json=_request_body())
    assert response.status_code == 401

    no_scope = test_client.post(
        "/api/v1/resume/analyze",
        json=_request_body(),
        headers={"Authorization": f"Bearer {_token(scopes=['interview:conduct'])}"},
    )
    assert no_scope.status_code == 403

    wrong_application = test_client.post(
        "/api/v1/resume/analyze",
        json=_request_body(),
        headers={"Authorization": f"Bearer {_token(application_id='another-application')}"},
    )
    assert wrong_application.status_code == 403

    wrong_tenant = test_client.post(
        "/api/v1/resume/analyze",
        json=_request_body(),
        headers={"Authorization": f"Bearer {_token(org_id='another-org')}"},
    )
    assert wrong_tenant.status_code == 403


def test_resume_analysis_returns_structured_report_and_verifies_evidence(
    test_client, monkeypatch
):
    provider = FakeLLM()
    monkeypatch.setattr("app.api.routes.resume.get_llm_provider", lambda: provider)
    response = test_client.post(
        "/api/v1/resume/analyze",
        json=_request_body(),
        headers={"Authorization": f"Bearer {_token()}"},
    )

    assert response.status_code == 200
    result = response.json()
    assert result["matchScore"] == 72
    assert result["requiredSkills"][1]["status"] == "not_evidenced"
    assert result["missingQualifications"][0]["title"] == "AWS"
    assert result["requiredSkills"][0]["resumeEvidence"] == [
        "Built Python services for customer applications"
    ]
    assert "Required skills: Python and AWS." in provider.prompt
    assert "STRUCTURED RESUME FIELDS" in provider.prompt


def test_fabricated_resume_evidence_is_removed_and_score_is_withheld(
    test_client, monkeypatch
):
    report = _report()
    report["strengths"][0]["resumeEvidence"] = ["Led a 40-person cloud migration."]
    provider = FakeLLM(response_text=json.dumps(report))
    monkeypatch.setattr("app.api.routes.resume.get_llm_provider", lambda: provider)

    response = test_client.post(
        "/api/v1/resume/analyze",
        json=_request_body(),
        headers={"Authorization": f"Bearer {_token()}"},
    )

    assert response.status_code == 200
    result = response.json()
    assert result["strengths"] == []
    assert result["analysisConfidence"] == "low"
    assert result["matchScore"] is None
    assert result["insufficientInformation"] is True


def test_resume_analysis_reports_insufficient_evidence_without_a_score(
    test_client, monkeypatch
):
    report = _report()
    report["requiredSkills"][0]["resumeEvidence"] = ["Unsupported candidate claim"]
    report["experienceAssessment"]["resumeEvidence"] = []
    report["strengths"] = []
    provider = FakeLLM(response_text=json.dumps(report))
    monkeypatch.setattr("app.api.routes.resume.get_llm_provider", lambda: provider)

    response = test_client.post(
        "/api/v1/resume/analyze",
        json=_request_body(),
        headers={"Authorization": f"Bearer {_token()}"},
    )

    assert response.status_code == 200
    result = response.json()
    assert result["matchScore"] is None
    assert result["insufficientInformation"] is True
    assert result["requiredSkills"][0]["status"] == "insufficient_evidence"


def test_short_resume_is_rejected_as_insufficient_input(test_client):
    response = test_client.post(
        "/api/v1/resume/analyze",
        json=_request_body("Short text."),
        headers={"Authorization": f"Bearer {_token()}"},
    )
    assert response.status_code == 422


def test_provider_failure_returns_retryable_service_error(test_client, monkeypatch):
    provider = FakeLLM(error=RuntimeError("provider unavailable"))
    monkeypatch.setattr("app.api.routes.resume.get_llm_provider", lambda: provider)

    response = test_client.post(
        "/api/v1/resume/analyze",
        json=_request_body(),
        headers={"Authorization": f"Bearer {_token()}"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Resume analysis provider is unavailable"


def test_malformed_provider_report_is_rejected(test_client, monkeypatch):
    provider = FakeLLM(response_text='{"matchScore": "not-a-number"}')
    monkeypatch.setattr("app.api.routes.resume.get_llm_provider", lambda: provider)

    response = test_client.post(
        "/api/v1/resume/analyze",
        json=_request_body(),
        headers={"Authorization": f"Bearer {_token()}"},
    )

    assert response.status_code == 502


def test_node_signer_token_authenticates_against_fastapi_resume_endpoint(
    test_client, monkeypatch
):
    api_root = Path(__file__).resolve().parents[3] / "api"
    node_env = os.environ.copy()
    node_env.update(
        {
            "NODE_ENV": "test",
            "DATABASE_URL": "postgresql://test:test@localhost:5432/test_db",
            "JWT_ACCESS_SECRET": "test_access_secret_for_node_fastapi_hmac_32_chars",
            "JWT_REFRESH_SECRET": "test_refresh_secret_for_node_fastapi_hmac_32_chars",
            "AI_SERVICE_SECRET": "shared_test_service_secret_for_node_fastapi_hmac_32_chars",
        }
    )
    script = """import { createAiServiceToken } from './src/integrations/ai-service-token.ts';
const token = await createAiServiceToken({
  organizationId: 'org-screening-1',
  applicationId: 'application-screening-1',
  scopes: ['resume:screen'],
});
process.stdout.write(token);
"""
    node_result = subprocess.run(
        [
            "node",
            "--import",
            "tsx",
            "--input-type=module",
            "-e",
            script,
        ],
        cwd=api_root,
        env=node_env,
        capture_output=True,
        check=False,
        text=True,
    )
    assert node_result.returncode == 0, "Node.js service-token signer failed"
    token = node_result.stdout.strip()
    assert token

    monkeypatch.setattr("app.api.routes.resume.get_llm_provider", lambda: FakeLLM())
    response = test_client.post(
        "/api/v1/resume/analyze",
        json=_request_body(),
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["matchScore"] == 72

