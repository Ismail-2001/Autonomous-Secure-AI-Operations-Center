"""Authentication dependencies for FastAPI.

Primary: JWT RS256 via jwt_handler module (require_jwt, require_role, require_permission).
Legacy: Simple HMAC token via require_api_token (for backward compatibility).
WebSocket: require_ws_token (HMAC-based, unchanged).
"""
import hmac
from typing import Optional

from fastapi import Header, HTTPException, WebSocketException, status

from src.asoc.core.config import settings

# Re-export JWT-based dependencies as the primary authentication mechanism
from src.asoc.core.jwt_handler import (  # noqa: F401
    Role,
    TokenPayload,
    require_jwt,
    require_permission,
    require_role,
    create_token_pair,
    rotate_refresh_token,
    verify_access_token,
)


def _get_ws_token() -> str:
    return settings.WS_API_TOKEN.get_secret_value() if settings.WS_API_TOKEN else ""


def _verify_token(token: str) -> bool:
    expected = _get_ws_token()
    if not expected:
        return False
    return hmac.compare_digest(token, expected)


async def require_api_token(
    authorization: Optional[str] = Header(None), x_api_key: Optional[str] = Header(None)
) -> Optional[TokenPayload]:
    """Backward-compatible token verification.

    Prefers JWT if a valid JWT is provided; falls back to HMAC API token.
    Returns TokenPayload if JWT, None if HMAC (legacy callers ignore return value).
    """
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif x_api_key:
        token = x_api_key

    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing API token")

    # Try JWT first
    payload = verify_access_token(token)
    if payload:
        return payload

    # Fall back to HMAC API token
    if _verify_token(token):
        return None

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing API token")


async def require_ws_token(token: str) -> None:
    if not _verify_token(token):
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
