"""Authentication, user login, token lifecycle, and WebSocket ticket routes."""

import os
from typing import Optional

from fastapi import Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from src.asoc.audit.audit_trail import get_audit_trail
from src.asoc.core.auth import (
    Role,
    TokenPayload,
    async_rotate_refresh_token,
    create_token_pair,
    create_ws_ticket,
    require_jwt,
    require_role,
    revoke_token,
    verify_access_token,
)
from src.asoc.core.config import settings
from src.asoc.core.logging import get_logger
from src.asoc.core.passwords import verify_password
from src.asoc.core.rate_limiter import check_rate_limit
from src.asoc.core.user_service import (
    get_user_by_username,
    is_user_locked,
    record_login_failure,
    record_login_success,
)

from . import router

logger = get_logger("asoc.api.auth")


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=128)
    password: str = Field(..., min_length=1)
    client_id: str = Field(default="default", max_length=128)


class TokenIssueRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    role: str = Field(default="analyst", pattern="^(readonly|analyst|supervisor|admin)$")
    client_id: str = Field(default="default", max_length=128)


class TokenRefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)
    client_id: str = Field(default="default", max_length=128)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)


class WSTicketResponse(BaseModel):
    ticket: str
    expires_in: int = 60


@router.post("/auth/login", dependencies=[Depends(check_rate_limit)])
async def login(request: LoginRequest):
    """Authenticate with username and password.

    Enforces Argon2id verification and 15-minute account lockout after 5 consecutive failed attempts.
    """
    user = await get_user_by_username(request.username)

    if not user or not user.get("is_active", True):
        # Constant-time comparison dummy check to prevent timing analysis
        verify_password("dummy", "$pbkdf2-sha256$600000$dummy$dummy")
        get_audit_trail().append(
            agent_id="auth",
            action="login_failed",
            payload={"username": request.username, "reason": "user_not_found"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Check if account is locked
    locked, remaining_seconds = is_user_locked(user)
    if locked:
        remaining_mins = max(1, (remaining_seconds or 0) // 60 + 1)
        logger.warning("login_attempt_on_locked_account", username=request.username)
        get_audit_trail().append(
            agent_id="auth",
            action="login_locked_rejected",
            payload={"username": request.username, "remaining_seconds": remaining_seconds},
        )
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account is temporarily locked due to excessive failed attempts. Try again in {remaining_mins} minutes.",
        )

    # Verify password
    if not verify_password(request.password, user.get("password_hash", "")):
        failed_count, locked_until = await record_login_failure(request.username)
        get_audit_trail().append(
            agent_id="auth",
            action="login_failed",
            payload={"username": request.username, "failed_count": failed_count},
        )
        if locked_until:
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail="Account locked due to 5 consecutive failed login attempts. Try again in 15 minutes.",
            )
        remaining_attempts = max(0, 5 - failed_count)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid username or password. Remaining attempts before lockout: {remaining_attempts}",
        )

    # Reset failure counter upon success
    await record_login_success(request.username)

    user_role = Role(user.get("role", "analyst"))
    token_pair = create_token_pair(
        user_id=str(user.get("id", request.username)),
        role=user_role,
        client_id=request.client_id,
    )

    get_audit_trail().append(
        agent_id="auth",
        action="login_success",
        payload={"username": request.username, "role": user_role.value},
    )

    return token_pair.model_dump()


@router.post("/auth/token", dependencies=[Depends(check_rate_limit)])
async def issue_token(request: TokenIssueRequest):
    """Dev-only arbitrary role token minting endpoint.

    Strictly disabled in production and staging environments to prevent unauthorized privilege minting.
    """
    env = os.getenv("ENVIRONMENT", settings.ENVIRONMENT).lower()
    if env in ("production", "prod", "staging"):
        logger.error("arbitrary_token_minting_blocked_in_production", env=env, requested_role=request.role)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Arbitrary token minting is disabled in production environments. Please authenticate via /auth/login.",
        )

    try:
        role = Role(request.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {request.role}")

    token_pair = create_token_pair(user_id=request.user_id, role=role, client_id=request.client_id)

    get_audit_trail().append(
        agent_id="auth",
        action="dev_token_issued",
        payload={"user_id": request.user_id, "role": role.value},
    )

    return token_pair.model_dump()


@router.post("/auth/refresh", dependencies=[Depends(check_rate_limit)])
async def refresh_token(request: TokenRefreshRequest):
    """Rotate refresh token. Old token is revoked; new pair is issued with reuse detection."""
    new_pair = await async_rotate_refresh_token(request.refresh_token, request.client_id)
    if not new_pair:
        raise HTTPException(status_code=401, detail="Invalid, expired, or revoked refresh token")

    get_audit_trail().append(
        agent_id="auth",
        action="token_refreshed",
        payload={"role": new_pair.role},
    )

    return new_pair.model_dump()


@router.post("/auth/logout", dependencies=[Depends(check_rate_limit)])
async def logout(request: LogoutRequest):
    """Revoke refresh token session upon logout."""
    try:
        from src.asoc.core.jwt_handler import _get_public_key
        import jwt

        payload = jwt.decode(request.refresh_token, _get_public_key(), algorithms=["RS256"])
        jti = payload.get("jti")
        if jti:
            revoke_token(jti)
            get_audit_trail().append(
                agent_id="auth",
                action="user_logged_out",
                payload={"jti": jti, "sub": payload.get("sub")},
            )
    except Exception as e:
        logger.warning("logout_token_decode_error", error=str(e))

    return {"ok": True, "message": "Successfully logged out"}


@router.post("/auth/ws-ticket", response_model=WSTicketResponse, dependencies=[Depends(check_rate_limit)])
async def get_ws_ticket(payload: TokenPayload = Depends(require_jwt)):
    """Generate a single-use, 60-second ticket for authenticating WebSocket connections from browsers."""
    role_str = payload.role.value if hasattr(payload.role, "value") else str(payload.role)
    ticket = await create_ws_ticket(user_id=payload.sub, role=role_str, ttl_seconds=60)

    get_audit_trail().append(
        agent_id="auth",
        action="ws_ticket_created",
        payload={"user_id": payload.sub, "role": role_str},
    )

    return {"ticket": ticket, "expires_in": 60}


@router.get("/auth/me", dependencies=[Depends(require_jwt)])
async def auth_me(request: Request):
    """Get current authenticated user identity and role."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else ""
    if not token:
        token = request.headers.get("X-Api-Key", "")

    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    return {
        "user_id": payload.sub,
        "role": (
            payload.role
            if isinstance(payload.role, str)
            else payload.role.value if hasattr(payload.role, "value") else str(payload.role)
        ),
        "token_type": payload.type,
    }
