"""
Aarohi AI Recruiter Service - Security, Tenant Isolation & Authentication.

Validates authenticated, short-lived service tokens issued by the main application backend.
Enforces multi-tenant isolation, cryptographically guarantees that requests cannot cross
organization boundaries or access arbitrary interview sessions.
"""

from datetime import UTC, datetime, timedelta

import jwt
from pydantic import BaseModel, Field, ValidationError

from app.core.config import get_settings
from app.core.exceptions import (
    InvalidTokenError,
    TenantAccessDeniedError,
    TokenExpiredError,
)
from app.core.logging import get_logger

logger = get_logger(__name__)

SERVICE_TOKEN_ALGORITHM = "HS256"
SERVICE_TOKEN_ISSUER = "aarohi-api"
SERVICE_TOKEN_AUDIENCE = "aarohi-ai-service"


class ServiceTokenClaims(BaseModel):
    """Strongly typed JWT claims payload for service-to-service authorization."""

    sub: str = Field(..., description="Subject identity (e.g. backend-service-worker)")
    org_id: str = Field(..., description="Authorized tenant organization ID")
    iss: str = Field(..., description="Trusted API issuer")
    aud: str | list[str] = Field(..., description="AI service audience")
    interview_id: str | None = Field(default=None, description="Authorized interview ID")
    application_id: str | None = Field(default=None, description="Authorized application ID")
    exp: int = Field(..., description="Expiration timestamp (Unix epoch)")
    iat: int = Field(..., description="Issued-at timestamp (Unix epoch)")
    scopes: list[str] = Field(..., description="Granted scopes for this operation")


def create_service_token(
    org_id: str,
    interview_id: str | None = None,
    subject: str = "ai-recruiter-backend",
    expires_in_seconds: int | None = None,
    scopes: list[str] | None = None,
    application_id: str | None = None,
) -> str:
    """
    Generate an HMAC-SHA256 signed service token.
    Used by the main backend and automated tests to authorize AI service requests.
    """
    settings = get_settings()
    ttl = (
        expires_in_seconds
        if expires_in_seconds is not None
        else settings.service_token_ttl_seconds
    )
    now = datetime.now(UTC)
    expiration = now + timedelta(seconds=ttl)

    payload = {
        "sub": subject,
        "org_id": org_id,
        "iss": SERVICE_TOKEN_ISSUER,
        "aud": SERVICE_TOKEN_AUDIENCE,
        "iat": int(now.timestamp()),
        "exp": int(expiration.timestamp()),
        "scopes": scopes if scopes is not None else ["interview:conduct"],
    }
    if interview_id:
        payload["interview_id"] = interview_id
    if application_id:
        payload["application_id"] = application_id

    token = jwt.encode(
        payload,
        settings.secret_key.get_secret_value(),
        algorithm=settings.algorithm,
    )
    return token


def verify_service_token(token: str) -> ServiceTokenClaims:
    """
    Cryptographically verify and decode a service token.
    Raises domain exceptions if the token is expired, tampered with, or malformed.
    """
    settings = get_settings()
    try:
        raw_payload = jwt.decode(
            token,
            settings.secret_key.get_secret_value(),
            algorithms=[SERVICE_TOKEN_ALGORITHM],
            issuer=SERVICE_TOKEN_ISSUER,
            audience=SERVICE_TOKEN_AUDIENCE,
            options={
                "require": ["sub", "org_id", "iss", "aud", "exp", "iat", "scopes"],
            },
        )
        claims = ServiceTokenClaims(**raw_payload)

        # If a strict organization whitelist is configured, check it
        if (
            settings.allowed_organization_ids
            and claims.org_id not in settings.allowed_organization_ids
        ):
            logger.warning(
                "Rejected service token for organization outside whitelist",
                extra={"org_id": claims.org_id},
            )
            raise TenantAccessDeniedError(
                message=f"Organization '{claims.org_id}' is not permitted on this instance."
            )

        return claims

    except jwt.ExpiredSignatureError as e:
        logger.warning("Service token expired")
        raise TokenExpiredError() from e
    except jwt.InvalidSignatureError as e:
        logger.error(
            "Service token signature mismatch; verify API AI_SERVICE_SECRET matches AI-service SECRET_KEY and both services use HS256"
        )
        raise InvalidTokenError(message="Invalid service token signature") from e
    except jwt.InvalidIssuerError as e:
        logger.warning("Service token rejected: issuer does not match the trusted API issuer")
        raise InvalidTokenError(message="Invalid service token issuer") from e
    except jwt.InvalidAudienceError as e:
        logger.warning("Service token rejected: audience does not match this AI service")
        raise InvalidTokenError(message="Invalid service token audience") from e
    except (jwt.InvalidTokenError, ValidationError, ValueError) as e:
        logger.warning("Service token rejected: malformed token or missing/invalid required claims")
        raise InvalidTokenError(message="Invalid service token") from e


def assert_tenant_authorization(
    claims: ServiceTokenClaims,
    expected_org_id: str,
    expected_interview_id: str | None = None,
) -> None:
    """
    Enforce tenant boundary checks. Verifies that the authenticated token
    matches the exact organization and interview resource being accessed.
    """
    if claims.org_id != expected_org_id:
        logger.error(
            "Tenant boundary violation attempt detected",
            extra={
                "token_org_id": claims.org_id,
                "attempted_org_id": expected_org_id,
            },
        )
        raise TenantAccessDeniedError(
            message="Tenant boundary violation: token organization does not match requested tenant."
        )

    if expected_interview_id and claims.interview_id != expected_interview_id:
        logger.error(
            "Interview resource boundary violation attempt detected",
            extra={
                "token_interview_id": claims.interview_id,
                "attempted_interview_id": expected_interview_id,
            },
        )
        raise TenantAccessDeniedError(
            message="Resource boundary violation: token does not authorize this interview ID."
        )
