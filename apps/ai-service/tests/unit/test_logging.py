"""
Unit tests for structured logging and sensitive data scrubbing.
"""

from app.core.logging import (
    correlation_id_ctx,
    interview_id_ctx,
    scrub_dict,
    scrub_text,
    tenant_id_ctx,
)


def test_scrub_text_removes_sensitive_patterns():
    """Verify that tokens, API keys, emails, and phone numbers are redacted."""
    raw_text = (
        "Candidate email is john.doe@example.com and phone is +1-555-123-4567. "
        "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDc. "
        "Gemini key is AIzaSyD98765432101234567890123456789012"
    )
    scrubbed = scrub_text(raw_text)

    assert "[REDACTED_EMAIL]" in scrubbed
    assert "john.doe@example.com" not in scrubbed
    assert "[REDACTED_PHONE]" in scrubbed
    assert "+1-555-123-4567" not in scrubbed
    assert "[REDACTED_TOKEN]" in scrubbed or "[REDACTED_JWT]" in scrubbed
    assert "[REDACTED_API_KEY]" in scrubbed
    assert "AIzaSyD98765432101234567890123456789012" not in scrubbed


def test_scrub_dict_removes_sensitive_keys():
    """Verify that dictionary keys containing secret/key/password are redacted."""
    payload = {
        "candidate_id": "cand_123",
        "api_key": "secret_live_key_xyz",
        "password_hash": "argon2$hash",
        "nested": {
            "auth_token": "token123",
            "safe_field": "public_info",
        },
    }
    scrubbed = scrub_dict(payload)

    assert scrubbed["candidate_id"] == "cand_123"
    assert scrubbed["api_key"] == "[REDACTED]"
    assert scrubbed["password_hash"] == "[REDACTED]"
    assert scrubbed["nested"]["auth_token"] == "[REDACTED]"
    assert scrubbed["nested"]["safe_field"] == "public_info"


def test_context_vars_propagation():
    """Verify context variables retain active values within context."""
    c_token = correlation_id_ctx.set("test-corr-123")
    t_token = tenant_id_ctx.set("org_test_tenant")
    i_token = interview_id_ctx.set("int_test_interview")

    assert correlation_id_ctx.get() == "test-corr-123"
    assert tenant_id_ctx.get() == "org_test_tenant"
    assert interview_id_ctx.get() == "int_test_interview"

    correlation_id_ctx.reset(c_token)
    tenant_id_ctx.reset(t_token)
    interview_id_ctx.reset(i_token)
