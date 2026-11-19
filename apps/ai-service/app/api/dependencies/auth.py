"""
Aarohi AI Recruiter Service - Authentication Dependencies.

FastAPI dependency for verifying short-lived backend service tokens
and establishing tenant context for the active request.
"""

from fastapi import Header

from app.core.exceptions import AuthenticationError
from app.core.logging import interview_id_ctx, tenant_id_ctx
from app.core.security import ServiceTokenClaims, verify_service_token


async def get_authenticated_service_token(
    authorization: str | None = Header(None, description="Bearer <service_jwt_token>"),
) -> ServiceTokenClaims:
    """
    Validates the incoming Authorization: Bearer <token> header.
    Binds the authenticated tenant_id and interview_id to the request context.
    """
    if not authorization:
        raise AuthenticationError("Authorization header missing")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthenticationError("Invalid Authorization header format. Must be 'Bearer <token>'")

    token = parts[1]
    claims = verify_service_token(token)

    # Set context variables for this execution
    tenant_id_ctx.set(claims.org_id)
    interview_id_ctx.set(claims.interview_id)

    return claims
