"""Authentication dependencies for FastAPI.

Primary: JWT RS256 via jwt_handler module (require_jwt, require_role, require_permission).
Legacy: Simple HMAC token via require_api_token (for backward compatibility).
WebSocket: require_ws_token (HMAC-based, unchanged).
"""

import hmac
import logging
from typing import Optional

from fastapi import Header, HTTPException, WebSocketException, status

from src.asoc.core.config import settings

# Re-export JWT-based dependencies as the primary authentication mechanism
from src.asoc.core.jwt_handler import (  # noqa: F401
    Role,
    TokenPayload,
    create_token_pair,
    require_jwt,
    require_permission,
    require_role,
    rotate_refresh_token,
    verify_access_token,
)

logger = logging.getLogger("asoc.auth")


def _get_ws_token() -> str:
    return settings.WS_API_TOKEN.get_secret_value() if settings.WS_API_TOKEN else ""


def _verify_token(token: str) -> bool:
    expected = _get_ws_token()
    if not expected:
        logger.warning("WS_API_TOKEN not configured — all WebSocket tokens rejected")
        return False
    return hmac.compare_digest(token, expected)


async def require_api_token(
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None),
) -> Optional[TokenPayload]:
    """Backward-compatible token verification.

    Prefers JWT if a valid JWT is provided; falls back to HMAC API token.
    Returns TokenPayload if JWT, None if HMAC (legacy callers ignore return value).

    Raises:
        HTTPException: 401 if token is missing or invalid.
    """
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif x_api_key:
        token = x_api_key

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API token",
        )

    # Try JWT first
    payload = verify_access_token(token)
    if payload:
        logger.debug("JWT auth succeeded for role=%s", payload.role)
        return payload

    # Fall back to HMAC API token
    if _verify_token(token):
        logger.debug("HMAC API token auth succeeded (legacy)")
        return None

    logger.warning("Authentication failed — invalid token presented")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing API token",
    )


async def require_ws_token(token: str) -> None:
    """WebSocket authentication via query parameter token.

    Raises:
        WebSocketException: 1008 (Policy Violation) if token is invalid.
    """
    if not _verify_token(token):
        logger.warning("WebSocket authentication failed")
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
