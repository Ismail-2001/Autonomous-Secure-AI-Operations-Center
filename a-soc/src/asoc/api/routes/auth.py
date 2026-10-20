"""Authentication and token management routes."""

from fastapi import Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from src.asoc.audit.audit_trail import get_audit_trail
from src.asoc.core.auth import Role, require_jwt, require_role
from src.asoc.core.jwt_handler import create_token_pair, rotate_refresh_token, verify_access_token
from src.asoc.core.rate_limiter import check_rate_limit

from . import router


class TokenIssueRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=128)
    role: str = Field(default="analyst", pattern="^(readonly|analyst|supervisor|admin)$")
    client_id: str = Field(default="default", max_length=128)


class TokenRefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)
    client_id: str = Field(default="default", max_length=128)


@router.post("/auth/token", dependencies=[Depends(check_rate_limit)])
async def issue_token(request: TokenIssueRequest):
    try:
        role = Role(request.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {request.role}")

    token_pair = create_token_pair(user_id=request.user_id, role=role, client_id=request.client_id)

    get_audit_trail().append(
        agent_id="auth",
        action="token_issued",
        payload={"user_id": request.user_id, "role": role.value},
    )

    return token_pair.model_dump()


@router.post("/auth/refresh", dependencies=[Depends(check_rate_limit)])
async def refresh_token(request: TokenRefreshRequest):
    new_pair = rotate_refresh_token(request.refresh_token, request.client_id)
    if not new_pair:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    get_audit_trail().append(
        agent_id="auth",
        action="token_refreshed",
        payload={"role": new_pair.role},
    )

    return new_pair.model_dump()


@router.get("/auth/me", dependencies=[Depends(require_jwt)])
async def auth_me(request: Request):
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
