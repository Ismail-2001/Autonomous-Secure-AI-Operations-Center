"""JWT RS256 authentication with refresh token rotation and RBAC.

Security properties:
- RS256 (asymmetric): private key signs, public key verifies
- Refresh token rotation: each use invalidates the old refresh token
- Role-based access: ANALYST | SUPERVISOR | ADMIN | READONLY
- Token fingerprinting: binds tokens to client to prevent theft
"""
import hashlib
import secrets
import time
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Optional

import jwt
from pydantic import BaseModel, Field

from src.asoc.core.config import settings
from src.asoc.core.logging import get_logger

logger = get_logger("asoc.auth.jwt")

# ── Key Management ────────────────────────────────────────────────────────

_KEY_CACHE: dict[str, Any] = {}


def _get_private_key() -> str:
    """Load RS256 private key from env or generate ephemeral keypair for dev."""
    key = settings.JWT_PRIVATE_KEY
    if key:
        return key.get_secret_value()
    return _ensure_dev_keys()


def _get_public_key() -> str:
    """Load RS256 public key from env or use dev keypair."""
    key = settings.JWT_PUBLIC_KEY
    if key:
        return key.get_secret_value()
    return _ensure_dev_keys(public_only=True)


def _ensure_dev_keys(public_only: bool = False) -> str:
    """Generate ephemeral RSA keypair for development. NOT for production."""
    cache_key = "dev_public" if public_only else "dev_private"
    if cache_key in _KEY_CACHE:
        return _KEY_CACHE[cache_key]

    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    if "dev_private" not in _KEY_CACHE:
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        _KEY_CACHE["dev_private"] = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode()
        _KEY_CACHE["dev_public"] = private_key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode()
        logger.warning("dev_rsa_keypair_generated — NOT for production")

    return _KEY_CACHE[cache_key]


# ── Roles ─────────────────────────────────────────────────────────────────

class Role(str, Enum):
    READONLY = "readonly"
    ANALYST = "analyst"
    SUPERVISOR = "supervisor"
    ADMIN = "admin"


ROLE_HIERARCHY: dict[Role, int] = {
    Role.READONLY: 0,
    Role.ANALYST: 1,
    Role.SUPERVISOR: 2,
    Role.ADMIN: 3,
}

# Permission matrix: role → set of allowed OPA policy scopes
ROLE_PERMISSIONS: dict[Role, set[str]] = {
    Role.READONLY: {"read:dashboard", "read:events", "read:health"},
    Role.ANALYST: {
        "read:dashboard", "read:events", "read:health",
        "write:hunting", "write:simulation",
        "agent:telemetry", "agent:detection", "agent:forensics",
    },
    Role.SUPERVISOR: {
        "read:dashboard", "read:events", "read:health",
        "write:hunting", "write:simulation",
        "agent:telemetry", "agent:detection", "agent:forensics",
        "agent:supervisor", "approve:action", "escalate:incident",
    },
    Role.ADMIN: {
        "read:dashboard", "read:events", "read:health", "read:audit",
        "write:hunting", "write:simulation", "write:config",
        "agent:telemetry", "agent:detection", "agent:forensics",
        "agent:supervisor", "agent:response", "agent:compliance", "agent:notification",
        "approve:action", "escalate:incident",
        "admin:users", "admin:keys", "admin:policy",
    },
}


def has_permission(role: Role, permission: str) -> bool:
    """Check if a role has a specific permission."""
    return permission in ROLE_PERMISSIONS.get(role, set())


def role_at_least(role: Role, min_role: Role) -> bool:
    """Check if a role meets a minimum privilege level."""
    return ROLE_HIERARCHY.get(role, 0) >= ROLE_HIERARCHY.get(min_role, 0)


# ── Token Models ──────────────────────────────────────────────────────────

class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access token TTL in seconds")
    role: str


class TokenPayload(BaseModel):
    sub: str  # user_id
    role: Role
    fingerprint: str  # SHA-256 of client identifier
    type: str  # "access" or "refresh"
    jti: str  # unique token ID for revocation
    iat: float
    exp: float


class RefreshTokenRecord(BaseModel):
    jti: str
    user_id: str
    fingerprint: str
    created_at: float
    expires_at: float
    revoked: bool = False
    replaced_by_jti: Optional[str] = None


# ── Token Store (in-memory, production uses Redis/DB) ────────────────────

_refresh_tokens: dict[str, RefreshTokenRecord] = {}


def _fingerprint(client_id: str) -> str:
    """SHA-256 fingerprint of client identifier for token binding."""
    return hashlib.sha256(client_id.encode()).hexdigest()[:16]


# ── Token Creation ────────────────────────────────────────────────────────

def create_token_pair(
    user_id: str,
    role: Role,
    client_id: str = "default",
    access_ttl_seconds: int = 900,
    refresh_ttl_seconds: int = 86400,
) -> TokenPair:
    """Create access + refresh token pair with fingerprint binding."""
    now = time.time()
    fp = _fingerprint(client_id)

    access_jti = secrets.token_urlsafe(16)
    access_payload = {
        "sub": user_id,
        "role": role.value,
        "fingerprint": fp,
        "type": "access",
        "jti": access_jti,
        "iat": now,
        "exp": now + access_ttl_seconds,
    }
    access_token = jwt.encode(access_payload, _get_private_key(), algorithm="RS256")

    refresh_jti = secrets.token_urlsafe(16)
    refresh_payload = {
        "sub": user_id,
        "role": role.value,
        "fingerprint": fp,
        "type": "refresh",
        "jti": refresh_jti,
        "iat": now,
        "exp": now + refresh_ttl_seconds,
    }
    refresh_token = jwt.encode(refresh_payload, _get_private_key(), algorithm="RS256")

    # Store refresh token record
    _refresh_tokens[refresh_jti] = RefreshTokenRecord(
        jti=refresh_jti,
        user_id=user_id,
        fingerprint=fp,
        created_at=now,
        expires_at=now + refresh_ttl_seconds,
    )

    logger.info("token_pair_created", user_id=user_id, role=role.value)

    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=access_ttl_seconds,
        role=role.value,
    )


# ── Token Verification ───────────────────────────────────────────────────

def verify_access_token(token: str, client_id: str = "default") -> Optional[TokenPayload]:
    """Verify access token signature, expiry, and fingerprint binding."""
    try:
        payload = jwt.decode(token, _get_public_key(), algorithms=["RS256"])
        tp = TokenPayload(**payload)

        if tp.type != "access":
            logger.warning("wrong_token_type", expected="access", got=tp.type)
            return None

        expected_fp = _fingerprint(client_id)
        if tp.fingerprint != expected_fp:
            logger.warning("fingerprint_mismatch", token_jti=tp.jti)
            return None

        return tp

    except jwt.ExpiredSignatureError:
        logger.info("token_expired")
        return None
    except jwt.InvalidSignatureError:
        logger.warning("invalid_token_signature")
        return None
    except Exception as e:
        logger.warning("token_verification_failed", error=str(e))
        return None


def rotate_refresh_token(
    old_refresh_token: str,
    client_id: str = "default",
) -> Optional[TokenPair]:
    """Rotate refresh token: verify old, revoke it, issue new pair."""
    try:
        payload = jwt.decode(old_refresh_token, _get_public_key(), algorithms=["RS256"])
        tp = TokenPayload(**payload)

        if tp.type != "refresh":
            logger.warning("not_a_refresh_token")
            return None

        record = _refresh_tokens.get(tp.jti)
        if not record:
            logger.warning("refresh_token_not_found", jti=tp.jti)
            return None

        if record.revoked:
            logger.warning("refresh_token_reuse_detected", jti=tp.jti, user_id=tp.sub)
            _revoke_all_user_tokens(tp.sub)
            return None

        expected_fp = _fingerprint(client_id)
        if record.fingerprint != expected_fp:
            logger.warning("refresh_fingerprint_mismatch")
            return None

        # Revoke old refresh token
        record.revoked = True

        # Issue new pair
        new_pair = create_token_pair(
            user_id=tp.sub,
            role=Role(tp.role),
            client_id=client_id,
        )

        # Link old → new for audit trail
        record.replaced_by_jti = new_pair.access_token[:16]

        logger.info("refresh_token_rotated", user_id=tp.sub, old_jti=tp.jti)
        return new_pair

    except jwt.ExpiredSignatureError:
        logger.info("refresh_token_expired")
        return None
    except Exception as e:
        logger.warning("refresh_rotation_failed", error=str(e))
        return None


def _revoke_all_user_tokens(user_id: str) -> None:
    """Revoke all refresh tokens for a user (security response to token reuse)."""
    for record in _refresh_tokens.values():
        if record.user_id == user_id:
            record.revoked = True
    logger.warning("all_tokens_revoked", user_id=user_id)


def revoke_token(jti: str) -> bool:
    """Revoke a specific refresh token."""
    record = _refresh_tokens.get(jti)
    if record:
        record.revoked = True
        return True
    return False


# ── FastAPI Dependencies ──────────────────────────────────────────────────

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer(auto_error=False)


async def require_jwt(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    x_api_key: Optional[str] = Header(None),
) -> TokenPayload:
    """FastAPI dependency: require valid JWT or API key."""
    if credentials:
        token = credentials.credentials
    elif x_api_key:
        token = x_api_key
    else:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authentication")

    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    return payload


def require_role(min_role: Role):
    """FastAPI dependency factory: require minimum role level."""

    async def _check(payload: TokenPayload = Depends(require_jwt)) -> TokenPayload:
        if not role_at_least(payload.role, min_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {min_role.value}, your role: {payload.role.value}",
            )
        return payload

    return _check


def require_permission(permission: str):
    """FastAPI dependency factory: require specific permission."""

    async def _check(payload: TokenPayload = Depends(require_jwt)) -> TokenPayload:
        if not has_permission(payload.role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {permission}",
            )
        return payload

    return _check
