"""
Unit tests for security tokens, tenant isolation, and resource boundary enforcement.
"""

from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.config import get_settings
from app.core.exceptions import (
    InvalidTokenError,
    TenantAccessDeniedError,
    TokenExpiredError,
)
from app.core.security import (
    assert_tenant_authorization,
    create_service_token,
    verify_service_token,
)


def test_create_and_verify_valid_service_token():
    """Verify that a validly signed service token decodes into proper claims."""
    token = create_service_token(
        org_id="org_enterprise_123",
        interview_id="int_candidate_456",
        subject="recruiter-backend-service",
    )
    claims = verify_service_token(token)

    assert claims.org_id == "org_enterprise_123"
    assert claims.interview_id == "int_candidate_456"
    assert claims.sub == "recruiter-backend-service"
    assert "interview:conduct" in claims.scopes


def test_reject_expired_service_token():
    """Verify that expired service tokens are strictly rejected."""
    # Create token with -10 second expiration
    token = create_service_token(
        org_id="org_enterprise_123",
        interview_id="int_candidate_456",
        expires_in_seconds=-10,
    )
    with pytest.raises(TokenExpiredError):
        verify_service_token(token)


def test_reject_tampered_service_token():
    """Verify that signature tampering is detected and rejected."""
    valid_token = create_service_token(
        org_id="org_enterprise_123",
        interview_id="int_candidate_456",
    )
    # Tamper with token string
    tampered_token = valid_token[:-4] + "abcd"

    with pytest.raises(InvalidTokenError):
        verify_service_token(tampered_token)


def test_reject_service_token_signed_with_a_different_secret(caplog):
    now = datetime.now(UTC)
    payload = {
        "sub": "ai-recruiter-backend",
        "org_id": "org_enterprise_123",
        "iss": "aarohi-api",
        "aud": "aarohi-ai-service",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=60)).timestamp()),
        "scopes": ["interview:conduct"],
        "interview_id": "int_candidate_456",
    }
    token = jwt.encode(payload, "different_service_secret_not_the_configured_key", algorithm="HS256")

    with pytest.raises(InvalidTokenError):
        verify_service_token(token)
    assert "AI_SERVICE_SECRET matches AI-service SECRET_KEY" in caplog.text
    assert "different_service_secret_not_the_configured_key" not in caplog.text
    assert token not in caplog.text


@pytest.mark.parametrize(
    ("claim", "incorrect_value"),
    [
        ("iss", "untrusted-api"),
        ("aud", "another-service"),
    ],
)
def test_reject_incorrect_issuer_and_audience_claims(claim, incorrect_value):
    now = datetime.now(UTC)
    payload = {
        "sub": "ai-recruiter-backend",
        "org_id": "org_enterprise_123",
        "iss": "aarohi-api",
        "aud": "aarohi-ai-service",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=60)).timestamp()),
        "scopes": ["interview:conduct"],
        "interview_id": "int_candidate_456",
    }
    payload[claim] = incorrect_value
    settings = get_settings()
    token = jwt.encode(payload, settings.secret_key.get_secret_value(), algorithm="HS256")

    with pytest.raises(InvalidTokenError):
        verify_service_token(token)


def test_reject_missing_required_scope_claim():
    now = datetime.now(UTC)
    payload = {
        "sub": "ai-recruiter-backend",
        "org_id": "org_enterprise_123",
        "iss": "aarohi-api",
        "aud": "aarohi-ai-service",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=60)).timestamp()),
        "interview_id": "int_candidate_456",
    }
    token = jwt.encode(payload, get_settings().secret_key.get_secret_value(), algorithm="HS256")

    with pytest.raises(InvalidTokenError):
        verify_service_token(token)


def test_tenant_authorization_boundary_enforcement():
    """Verify that tenant authorization checks prevent cross-tenant access."""
    token = create_service_token(
        org_id="org_tenant_A",
        interview_id="interview_001",
    )
    claims = verify_service_token(token)

    # Same tenant and interview succeeds
    assert_tenant_authorization(
        claims=claims,
        expected_org_id="org_tenant_A",
        expected_interview_id="interview_001",
    )

    # Different tenant must be rejected
    with pytest.raises(TenantAccessDeniedError, match="organization does not match"):
        assert_tenant_authorization(
            claims=claims,
            expected_org_id="org_tenant_B",
            expected_interview_id="interview_001",
        )

    # Different interview ID must be rejected
    with pytest.raises(TenantAccessDeniedError, match="does not authorize this interview ID"):
        assert_tenant_authorization(
            claims=claims,
            expected_org_id="org_tenant_A",
            expected_interview_id="interview_999",
        )
