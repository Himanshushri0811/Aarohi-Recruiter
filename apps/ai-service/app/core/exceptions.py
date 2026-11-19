"""
Aarohi AI Recruiter Service - Domain Exceptions Hierarchy.

Standardized exception classes for strict domain error handling,
correlation tracking, and API problem details mapping.
"""

from typing import Any


class AarohiException(Exception):
    """Base exception for all Aarohi AI Recruiter service errors."""

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_SERVER_ERROR",
        status_code: int = 500,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}

    def to_dict(self) -> dict[str, Any]:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
            }
        }


# ------------------------------------------------------------------------------
# Configuration & Lifecycle Exceptions
# ------------------------------------------------------------------------------


class ConfigurationError(AarohiException):
    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(
            message=message,
            code="CONFIGURATION_ERROR",
            status_code=500,
            details=details,
        )


# ------------------------------------------------------------------------------
# Security, Authentication & Tenant Isolation Exceptions
# ------------------------------------------------------------------------------


class SecurityError(AarohiException):
    def __init__(
        self,
        message: str,
        code: str = "SECURITY_VIOLATION",
        status_code: int = 403,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            message=message,
            code=code,
            status_code=status_code,
            details=details,
        )


class AuthenticationError(SecurityError):
    def __init__(
        self, message: str = "Authentication required", details: dict[str, Any] | None = None
    ) -> None:
        super().__init__(
            message=message,
            code="AUTHENTICATION_FAILED",
            status_code=401,
            details=details,
        )


class InvalidTokenError(AuthenticationError):
    def __init__(
        self,
        message: str = "Invalid or malformed service token",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            message=message,
            details=details,
        )
        self.code = "INVALID_TOKEN"


class TokenExpiredError(AuthenticationError):
    def __init__(
        self, message: str = "Service token has expired", details: dict[str, Any] | None = None
    ) -> None:
        super().__init__(
            message=message,
            details=details,
        )
        self.code = "TOKEN_EXPIRED"


class TenantAccessDeniedError(SecurityError):
    def __init__(
        self,
        message: str = "Access to the requested tenant or interview resource is denied",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            message=message,
            code="TENANT_ACCESS_DENIED",
            status_code=403,
            details=details,
        )


# ------------------------------------------------------------------------------
# Interview Session & State Machine Exceptions
# ------------------------------------------------------------------------------


class SessionError(AarohiException):
    def __init__(
        self,
        message: str,
        code: str = "SESSION_ERROR",
        status_code: int = 400,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            message=message,
            code=code,
            status_code=status_code,
            details=details,
        )


class SessionNotFoundError(SessionError):
    def __init__(self, session_id: str) -> None:
        super().__init__(
            message=f"Interview session '{session_id}' not found",
            code="SESSION_NOT_FOUND",
            status_code=404,
            details={"session_id": session_id},
        )


class SessionStateConflictError(SessionError):
    def __init__(self, message: str, current_state: str, attempted_transition: str) -> None:
        super().__init__(
            message=message,
            code="SESSION_STATE_CONFLICT",
            status_code=409,
            details={
                "current_state": current_state,
                "attempted_transition": attempted_transition,
            },
        )


class SessionTimeoutError(SessionError):
    def __init__(self, session_id: str, max_duration_minutes: int) -> None:
        super().__init__(
            message=f"Interview session '{session_id}' exceeded max duration of {max_duration_minutes} minutes",
            code="SESSION_TIMEOUT",
            status_code=408,
            details={"session_id": session_id, "max_duration_minutes": max_duration_minutes},
        )


class StateTransitionError(AarohiException):
    def __init__(
        self,
        from_stage: str,
        to_stage: str,
        reason: str = "Invalid stage transition",
    ) -> None:
        super().__init__(
            message=f"Cannot transition from {from_stage} to {to_stage}: {reason}",
            code="INVALID_STATE_TRANSITION",
            status_code=422,
            details={"from_stage": from_stage, "to_stage": to_stage, "reason": reason},
        )


# ------------------------------------------------------------------------------
# External AI / Voice Provider Exceptions
# ------------------------------------------------------------------------------


class ProviderError(AarohiException):
    def __init__(
        self,
        provider: str,
        message: str,
        code: str = "PROVIDER_ERROR",
        status_code: int = 502,
        details: dict[str, Any] | None = None,
    ) -> None:
        merged_details = {"provider": provider}
        if details:
            merged_details.update(details)
        super().__init__(
            message=f"[{provider}] {message}",
            code=code,
            status_code=status_code,
            details=merged_details,
        )


class LLMProviderError(ProviderError):
    def __init__(self, provider: str, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(
            provider=provider,
            message=message,
            code="LLM_PROVIDER_ERROR",
            details=details,
        )


class STTProviderError(ProviderError):
    def __init__(self, provider: str, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(
            provider=provider,
            message=message,
            code="STT_PROVIDER_ERROR",
            details=details,
        )


class TTSProviderError(ProviderError):
    def __init__(self, provider: str, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(
            provider=provider,
            message=message,
            code="TTS_PROVIDER_ERROR",
            details=details,
        )


class ProviderQuotaExceededError(ProviderError):
    def __init__(self, provider: str, message: str = "Provider quota or budget exceeded") -> None:
        super().__init__(
            provider=provider,
            message=message,
            code="PROVIDER_QUOTA_EXCEEDED",
            status_code=429,
        )


# ------------------------------------------------------------------------------
# Evaluation Exceptions
# ------------------------------------------------------------------------------


class EvaluationError(AarohiException):
    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(
            message=message,
            code="EVALUATION_ERROR",
            status_code=422,
            details=details,
        )
