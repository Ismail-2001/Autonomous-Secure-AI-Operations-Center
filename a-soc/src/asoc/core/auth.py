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
    async_rotate_refresh_token,
    create_token_pair,
    require_jwt,
    require_permission,
    require_role,
    revoke_token,
    rotate_refresh_token,
    verify_access_token,
)
from src.asoc.core.redis_client import consume_ws_ticket, create_ws_ticket  # noqa: F401

logger = logging.getLogger("asoc.auth")


def _get_ws_token() -> str:
    return settings.WS_API_TOKEN.get_secret_value() if settings.WS_API_TOKEN else ""


def _verify_token(token: str) -> bool:
    expected = _get_ws_token()
    if not expected:
        logger.warning("WS_API_TOKEN not configured — checking JWT fallback")
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


async def require_ws_token(token: str = "", ticket: str = "") -> dict:
    """WebSocket authentication via ephemeral single-use ticket or token.

    Prefers ephemeral single-use tickets for browsers.
    Accepts static WS_API_TOKEN or RS256 JWT for automated machine clients.

    Raises:
        WebSocketException: 1008 (Policy Violation) if unauthorized.
    """
    # 1. Ephemeral single-use ticket (preferred for browser clients)
    if ticket:
        ticket_data = await consume_ws_ticket(ticket)
        if ticket_data:
            logger.info("websocket_ticket_authenticated", user_id=ticket_data.get("user_id"))
            return ticket_data
        logger.warning("invalid_or_expired_ws_ticket")

    # 2. Static machine token
    if token and _verify_token(token):
        logger.debug("websocket_static_token_authenticated")
        return {"user_id": "machine-client", "role": "admin"}

    # 3. JWT access token
    if token:
        payload = verify_access_token(token)
        if payload:
            logger.debug("websocket_jwt_authenticated", user_id=payload.sub)
            return {"user_id": payload.sub, "role": payload.role.value if hasattr(payload.role, "value") else str(payload.role)}

    logger.warning("websocket_authentication_failed")
    raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
