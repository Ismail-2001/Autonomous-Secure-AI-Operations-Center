"""Comprehensive JWT authentication tests.

Covers: token creation, verification, refresh rotation, RBAC, permissions.
These are the tests that were missing from test_auth.py (which only tests legacy HMAC).
"""

import time
from unittest.mock import patch

import jwt
import pytest
from fastapi import HTTPException
from pydantic import SecretStr

from src.asoc.core.jwt_handler import (
    ROLE_HIERARCHY,
    ROLE_PERMISSIONS,
    Role,
    TokenPayload,
    _fingerprint,
    _refresh_tokens,
    create_token_pair,
    has_permission,
    require_permission,
    require_role,
    revoke_token,
    rotate_refresh_token,
    role_at_least,
    verify_access_token,
)


@pytest.fixture(autouse=True)
def _clear_refresh_tokens():
    """Clear in-memory refresh token store between tests."""
    _refresh_tokens.clear()
    yield
    _refresh_tokens.clear()


@pytest.fixture
def token_pair():
    """Create a fresh token pair for testing."""
    return create_token_pair(user_id="test-user", role=Role.ANALYST, client_id="test-client")


# ── Token Creation ────────────────────────────────────────────────────────

class TestTokenCreation:
    def test_creates_valid_token_pair(self, token_pair):
        assert token_pair.access_token
        assert token_pair.refresh_token
        assert token_pair.token_type == "bearer"
        assert token_pair.expires_in == 900
        assert token_pair.role == "analyst"

    def test_access_token_is_decodable(self, token_pair):
        from src.asoc.core.jwt_handler import _get_public_key
        payload = jwt.decode(token_pair.access_token, _get_public_key(), algorithms=["RS256"])
        assert payload["sub"] == "test-user"
        assert payload["role"] == "analyst"
        assert payload["type"] == "access"
        assert "jti" in payload
        assert "fingerprint" in payload

    def test_refresh_token_is_decodable(self, token_pair):
        from src.asoc.core.jwt_handler import _get_public_key
        payload = jwt.decode(token_pair.refresh_token, _get_public_key(), algorithms=["RS256"])
        assert payload["sub"] == "test-user"
        assert payload["role"] == "analyst"
        assert payload["type"] == "refresh"

    def test_refresh_token_stored_internally(self, token_pair):
        from src.asoc.core.jwt_handler import _get_public_key
        payload = jwt.decode(token_pair.refresh_token, _get_public_key(), algorithms=["RS256"])
        assert payload["jti"] in _refresh_tokens

    def test_different_roles(self):
        for role in Role:
            pair = create_token_pair(user_id="u", role=role)
            assert pair.role == role.value

    def test_custom_ttl(self):
        pair = create_token_pair(user_id="u", role=Role.ADMIN, access_ttl_seconds=300, refresh_ttl_seconds=3600)
        assert pair.expires_in == 300

    def test_unique_jti_per_token(self):
        p1 = create_token_pair(user_id="u", role=Role.ANALYST)
        p2 = create_token_pair(user_id="u", role=Role.ANALYST)
        assert p1.access_token != p2.access_token


# ── Token Verification ───────────────────────────────────────────────────

class TestTokenVerification:
    def test_valid_token_returns_payload(self, token_pair):
        payload = verify_access_token(token_pair.access_token)
        assert payload is not None
        assert payload.sub == "test-user"
        assert payload.role == Role.ANALYST
        assert payload.type == "access"

    def test_refresh_token_rejected_as_access(self, token_pair):
        payload = verify_access_token(token_pair.refresh_token)
        assert payload is None

    def test_expired_token_rejected(self):
        pair = create_token_pair(user_id="u", role=Role.ANALYST, access_ttl_seconds=-1)
        payload = verify_access_token(pair.access_token)
        assert payload is None

    def test_invalid_signature_rejected(self, token_pair):
        from src.asoc.core.jwt_handler import _get_public_key
        payload = jwt.decode(token_pair.access_token, _get_public_key(), algorithms=["RS256"])
        payload["role"] = "admin"
        tampered = jwt.encode(payload, "wrong-key", algorithm="HS256")
        result = verify_access_token(tampered)
        assert result is None

    def test_garbage_token_rejected(self):
        result = verify_access_token("not-a-jwt-token")
        assert result is None

    def test_fingerprint_binding(self, token_pair):
        payload = verify_access_token(token_pair.access_token, client_id="wrong-client")
        assert payload is None

    def test_correct_fingerprint(self, token_pair):
        payload = verify_access_token(token_pair.access_token, client_id="test-client")
        assert payload is not None


# ── Refresh Token Rotation ───────────────────────────────────────────────

class TestRefreshRotation:
    def test_successful_rotation(self, token_pair):
        new_pair = rotate_refresh_token(token_pair.refresh_token, client_id="test-client")
        assert new_pair is not None
        assert new_pair.access_token != token_pair.access_token
        assert new_pair.refresh_token != token_pair.refresh_token

    def test_old_refresh_token_revoked_after_rotation(self, token_pair):
        rotate_refresh_token(token_pair.refresh_token, client_id="test-client")
        from src.asoc.core.jwt_handler import _get_public_key
        payload = jwt.decode(token_pair.refresh_token, _get_public_key(), algorithms=["RS256"])
        record = _refresh_tokens.get(payload["jti"])
        assert record is not None
        assert record.revoked is True

    def test_reuse_detected_and_all_tokens_revoked(self, token_pair):
        rotate_refresh_token(token_pair.refresh_token, client_id="test-client")
        result = rotate_refresh_token(token_pair.refresh_token, client_id="test-client")
        assert result is None

    def test_access_token_cannot_be_rotated(self, token_pair):
        result = rotate_refresh_token(token_pair.access_token, client_id="test-client")
        assert result is None

    def test_wrong_fingerprint_rejected(self, token_pair):
        result = rotate_refresh_token(token_pair.refresh_token, client_id="wrong-client")
        assert result is None

    def test_nonexistent_token_rejected(self):
        result = rotate_refresh_token("nonexistent-token")
        assert result is None


# ── Role Hierarchy ───────────────────────────────────────────────────────

class TestRoleHierarchy:
    def test_admin_is_highest(self):
        assert role_at_least(Role.ADMIN, Role.ADMIN)
        assert role_at_least(Role.ADMIN, Role.SUPERVISOR)
        assert role_at_least(Role.ADMIN, Role.ANALYST)
        assert role_at_least(Role.ADMIN, Role.READONLY)

    def test_readonly_is_lowest(self):
        assert role_at_least(Role.READONLY, Role.READONLY)
        assert not role_at_least(Role.READONLY, Role.ANALYST)
        assert not role_at_least(Role.READONLY, Role.SUPERVISOR)
        assert not role_at_least(Role.READONLY, Role.ADMIN)

    def test_analyst_can_do_readonly(self):
        assert role_at_least(Role.ANALYST, Role.READONLY)
        assert not role_at_least(Role.ANALYST, Role.SUPERVISOR)

    def test_supervisor_can_do_analyst(self):
        assert role_at_least(Role.SUPERVISOR, Role.ANALYST)
        assert not role_at_least(Role.SUPERVISOR, Role.ADMIN)


# ── Permissions ──────────────────────────────────────────────────────────

class TestPermissions:
    def test_readonly_has_read(self):
        assert has_permission(Role.READONLY, "read:dashboard")
        assert not has_permission(Role.READONLY, "write:hunting")

    def test_analyst_has_write(self):
        assert has_permission(Role.ANALYST, "write:hunting")
        assert not has_permission(Role.ANALYST, "admin:users")

    def test_supervisor_has_approve(self):
        assert has_permission(Role.SUPERVISOR, "approve:action")
        assert has_permission(Role.SUPERVISOR, "escalate:incident")
        assert not has_permission(Role.SUPERVISOR, "admin:users")

    def test_admin_has_all(self):
        assert has_permission(Role.ADMIN, "admin:users")
        assert has_permission(Role.ADMIN, "admin:keys")
        assert has_permission(Role.ADMIN, "admin:policy")
        assert has_permission(Role.ADMIN, "agent:response")

    def test_permission_matrix_completeness(self):
        for role in Role:
            assert role in ROLE_PERMISSIONS
            assert "read:dashboard" in ROLE_PERMISSIONS[role]


# ── FastAPI Dependencies ─────────────────────────────────────────────────

class TestRequireRole:
    @pytest.mark.asyncio
    async def test_sufficient_role_passes(self, token_pair):
        from src.asoc.core.jwt_handler import require_jwt
        with patch("src.asoc.core.jwt_handler.verify_access_token", return_value=TokenPayload(
            sub="u", role=Role.ADMIN, fingerprint="fp", type="access", jti="jti", iat=0, exp=9999999999
        )):
            dep = require_role(Role.ANALYST)
            result = await dep()
            assert result.role == Role.ADMIN

    @pytest.mark.asyncio
    async def test_insufficient_role_raises_403(self):
        with patch("src.asoc.core.jwt_handler.verify_access_token", return_value=TokenPayload(
            sub="u", role=Role.READONLY, fingerprint="fp", type="access", jti="jti", iat=0, exp=9999999999
        )):
            dep = require_role(Role.ADMIN)
            with pytest.raises(HTTPException) as exc:
                await dep()
            assert exc.value.status_code == 403


class TestRequirePermission:
    @pytest.mark.asyncio
    async def test_has_permission_passes(self):
        with patch("src.asoc.core.jwt_handler.verify_access_token", return_value=TokenPayload(
            sub="u", role=Role.ADMIN, fingerprint="fp", type="access", jti="jti", iat=0, exp=9999999999
        )):
            dep = require_permission("admin:users")
            result = await dep()
            assert result.role == Role.ADMIN

    @pytest.mark.asyncio
    async def test_missing_permission_raises_403(self):
        with patch("src.asoc.core.jwt_handler.verify_access_token", return_value=TokenPayload(
            sub="u", role=Role.READONLY, fingerprint="fp", type="access", jti="jti", iat=0, exp=9999999999
        )):
            dep = require_permission("admin:users")
            with pytest.raises(HTTPException) as exc:
                await dep()
            assert exc.value.status_code == 403


# ── Token Revocation ────────────────────────────────────────────────────

class TestRevocation:
    def test_revoke_existing_token(self, token_pair):
        from src.asoc.core.jwt_handler import _get_public_key
        payload = jwt.decode(token_pair.refresh_token, _get_public_key(), algorithms=["RS256"])
        result = revoke_token(payload["jti"])
        assert result is True
        assert _refresh_tokens[payload["jti"]].revoked is True

    def test_revoke_nonexistent_token(self):
        result = revoke_token("nonexistent-jti")
        assert result is False


# ── Fingerprint ──────────────────────────────────────────────────────────

class TestFingerprint:
    def test_consistent_fingerprint(self):
        fp1 = _fingerprint("client-1")
        fp2 = _fingerprint("client-1")
        assert fp1 == fp2

    def test_different_clients_different_fingerprints(self):
        fp1 = _fingerprint("client-1")
        fp2 = _fingerprint("client-2")
        assert fp1 != fp2

    def test_fingerprint_is_hex(self):
        fp = _fingerprint("test")
        assert len(fp) == 16
        int(fp, 16)  # Should not raise
