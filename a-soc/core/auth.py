import hmac
import os
from typing import Optional

from fastapi import Header, HTTPException, WebSocketException, status

from core.config.settings import settings


def _verify_token(token: str) -> bool:
    expected = os.getenv("WS_API_TOKEN", "")
    if not expected:
        api_key = settings.HMAC_SECRET.get_secret_value() if settings.HMAC_SECRET else ""
        expected = api_key or "dev-token"
    return hmac.compare_digest(token, expected)


async def require_api_token(
    authorization: Optional[str] = Header(None), x_api_key: Optional[str] = Header(None)
) -> None:
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif x_api_key:
        token = x_api_key

    if not token or not _verify_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing API token")


async def require_ws_token(token: str) -> None:
    if not _verify_token(token):
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION)
