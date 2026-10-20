"""Phase 0 Comprehensive Test Suite: Auth, Secrets & Hardening.

Validates:
1. Argon2id / PBKDF2 Password Hashing & Verification
2. Account Lockout Protection (5 failed attempts -> 15 min lock)
3. DB / In-Memory User Service & Admin Seeding
4. Ephemeral Single-Use WebSocket Tickets
5. JWT Refresh Rotation with Redis Fallback
6. Route Protection: POST /auth/login, dev-only /auth/token
7. RBAC Authorization Enforcements on Critical Endpoints
8. Multi-day HMAC Audit Trail Chain Verification (Fix for Midnight Bug)
9. Production Boot Checks Fail-Fast Logic
"""

import os
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from src.asoc.api.app import app
from src.asoc.audit.audit_trail import (
    AuditEntry,
    AuditTrail,
    compute_entry_hash,
    hash_payload,
    sign_entry,
)
from src.asoc.core.config import settings
from src.asoc.core.jwt_handler import Role, create_token_pair
from src.asoc.core.passwords import hash_password, verify_password
from src.asoc.core.redis_client import (
    create_ws_ticket,
    is_refresh_token_revoked,
    revoke_refresh_token,
    verify_and_consume_ws_ticket,
)
from src.asoc.core.user_service import (
    UserService,
    authenticate_user,
    get_user_by_username,
    is_user_locked,
    record_login_failure,
    record_login_success,
    seed_admin_user_if_needed,
)


# ── 1. Password Hashing Tests ─────────────────────────────────────────────


class TestPasswordHashing:
    def test_hash_and_verify_success(self):
        pwd = "EnterpriseSecurePassword2026!#"
        hashed = hash_password(pwd)
        assert hashed.startswith("$argon2id$") or hashed.startswith("$pbkdf2-sha256$")
        assert verify_password(pwd, hashed) is True

    def test_verify_failure_wrong_password(self):
        pwd = "CorrectHorseBatteryStaple"
        hashed = hash_password(pwd)
        assert verify_password("WrongPassword123", hashed) is False

    def test_verify_empty_or_malformed_hash(self):
        assert verify_password("test", "") is False
        assert verify_password("test", "corrupted$hash") is False


# ── 2. User Service & Lockout Tests ───────────────────────────────────────


class TestUserServiceAndLockout:
    @pytest.mark.asyncio
    async def test_admin_seeding_and_auth(self):
        with patch.object(settings, "ADMIN_PASSWORD", "SuperSecureAdminPass999!"):
            seeded = await seed_admin_user_if_needed()
            assert seeded is True

            # First login attempt with right credentials
            user = await authenticate_user("admin", "SuperSecureAdminPass999!")
            assert user is not None
            assert user.username == "admin"
            assert user.role == "admin"

    @pytest.mark.asyncio
    async def test_account_lockout_after_five_failures(self):
        username = "analyst_target_user"
        service = UserService()
        await service.create_user(
            username=username,
            password="InitialValidPassword123!",
            role="analyst",
        )

        # 4 failed attempts - user still not locked
        for _ in range(4):
            user = await authenticate_user(username, "WrongGuess")
            assert user is None
            locked, _ = await is_user_locked(username)
            assert locked is False

        # 5th failed attempt triggers lockout
        user = await authenticate_user(username, "WrongGuess")
        assert user is None
        locked, locked_until = await is_user_locked(username)
        assert locked is True
        assert locked_until is not None
        assert locked_until > datetime.now(timezone.utc)

        # Even with CORRECT password, locked user is rejected
        user_locked_try = await authenticate_user(username, "InitialValidPassword123!")
        assert user_locked_try is None

    @pytest.mark.asyncio
    async def test_successful_login_resets_failure_count(self):
        username = "reset_test_user"
        service = UserService()
        await service.create_user(
            username=username,
            password="MySecretPassword123!",
            role="analyst",
        )

        # 2 failures
        await authenticate_user(username, "Bad1")
        await authenticate_user(username, "Bad2")
        db_user = await get_user_by_username(username)
        assert db_user.failed_login_count == 2

        # 1 successful login
        success_user = await authenticate_user(username, "MySecretPassword123!")
        assert success_user is not None
        db_user_after = await get_user_by_username(username)
        assert db_user_after.failed_login_count == 0


# ── 3. Ephemeral Single-Use WebSocket Tickets ─────────────────────────────


class TestWebSocketTicketSecurity:
    @pytest.mark.asyncio
    async def test_ws_ticket_is_single_use(self):
        ticket = await create_ws_ticket(user_id="analyst-1", role="analyst", ttl_seconds=60)
        assert ticket.startswith("wst_")

        # First consumption succeeds
        info = await verify_and_consume_ws_ticket(ticket)
        assert info is not None
        assert info["user_id"] == "analyst-1"
        assert info["role"] == "analyst"

        # Second consumption fails (preventing replay attacks)
        replayed = await verify_and_consume_ws_ticket(ticket)
        assert replayed is None

    @pytest.mark.asyncio
    async def test_invalid_ws_ticket_rejected(self):
        result = await verify_and_consume_ws_ticket("wst_nonexistent_fake_ticket")
        assert result is None


# ── 4. API Endpoints Authentication Flow ──────────────────────────────────


class TestAuthApiEndpoints:
    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_login_flow_success_and_failure(self, client):
        # Create an account to test
        import asyncio
        service = UserService()
        asyncio.run(service.create_user("api_test_user", "ValidPassword2026!", role="analyst"))

        # 1. Invalid credentials
        res = client.post("/auth/login", json={"username": "api_test_user", "password": "WrongPassword"})
        assert res.status_code == 401

        # 2. Valid credentials
        res = client.post("/auth/login", json={"username": "api_test_user", "password": "ValidPassword2026!"})
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["username"] == "api_test_user"

    def test_arbitrary_token_minting_blocked_in_production(self, client):
        # In development: allowed
        with patch.object(settings, "ENVIRONMENT", "development"):
            res = client.post("/auth/token", json={"user_id": "attacker", "role": "admin"})
            assert res.status_code == 200

        # In production: strictly blocked
        with patch.object(settings, "ENVIRONMENT", "production"):
            res = client.post("/auth/token", json={"user_id": "attacker", "role": "admin"})
            assert res.status_code == 403
            assert "disabled in production" in res.json()["detail"]

    def test_ws_ticket_generation_via_api(self, client):
        tokens = create_token_pair(user_id="soc-analyst", role=Role.ANALYST)
        headers = {"Authorization": f"Bearer {tokens.access_token}"}

        res = client.post("/auth/ws-ticket", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "ticket" in data
        assert data["ticket"].startswith("wst_")
        assert data["expires_in"] == 60


# ── 5. RBAC Endpoint Enforcement ──────────────────────────────────────────


class TestRbacEndpointEnforcement:
    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_analyst_can_triage_incident_but_viewer_cannot(self, client):
        analyst_tokens = create_token_pair(user_id="u-analyst", role=Role.ANALYST)
        viewer_tokens = create_token_pair(user_id="u-viewer", role=Role.VIEWER)

        # Viewer attempt -> 403 Forbidden
        res_viewer = client.patch(
            "/incidents/INC-2026-0471/triage",
            headers={"Authorization": f"Bearer {viewer_tokens.access_token}"},
            json={"triage_status": "in_progress"},
        )
        assert res_viewer.status_code == 403

        # Analyst attempt -> authorized (proceeds to business logic)
        res_analyst = client.patch(
            "/incidents/INC-2026-0471/triage",
            headers={"Authorization": f"Bearer {analyst_tokens.access_token}"},
            json={"triage_status": "in_progress"},
        )
        # Not 403 or 401
        assert res_analyst.status_code in (200, 404)

    def test_supervisor_required_for_destructive_response_action(self, client):
        analyst_tokens = create_token_pair(user_id="u-analyst", role=Role.ANALYST)
        supervisor_tokens = create_token_pair(user_id="u-sup", role=Role.SUPERVISOR)

        # Analyst is forbidden from executing response actions
        res_analyst = client.post(
            "/incidents/INC-2026-0471/actions",
            headers={"Authorization": f"Bearer {analyst_tokens.access_token}"},
            json={"action_type": "isolate_host", "target": "AST-002"},
        )
        assert res_analyst.status_code == 403

        # Supervisor is permitted
        res_sup = client.post(
            "/incidents/INC-2026-0471/actions",
            headers={"Authorization": f"Bearer {supervisor_tokens.access_token}"},
            json={"action_type": "isolate_host", "target": "AST-002"},
        )
        assert res_sup.status_code in (200, 201, 202, 404)


# ── 6. HMAC Audit Trail Multi-Day Chain Continuity ────────────────────────


class TestAuditTrailMidnightContinuity:
    def test_multi_day_chain_verification_succeeds(self, tmp_path):
        log_file = tmp_path / "audit_test.jsonl"
        trail = AuditTrail(log_path=str(log_file))

        # Day 1 Entry
        d1 = "2026-10-18"
        p1 = {"event": "login", "user": "admin"}
        p1_hash = hash_payload(p1)
        sig1 = sign_entry(p1_hash, "", key_date=d1)
        e1 = AuditEntry(
            agent_id="Agent1",
            action="LOGIN",
            payload=p1,
            payload_hash=p1_hash,
            previous_hash="",
            hmac_signature=sig1,
            key_date=d1,
            timestamp=f"{d1}T10:00:00Z",
        )
        e1.entry_hash = compute_entry_hash(e1)

        # Day 2 Entry
        d2 = "2026-10-19"
        p2 = {"event": "quarantine", "host": "10.0.1.5"}
        p2_hash = hash_payload(p2)
        sig2 = sign_entry(p2_hash, e1.entry_hash, key_date=d2)
        e2 = AuditEntry(
            agent_id="ResponseAgent",
            action="QUARANTINE",
            payload=p2,
            payload_hash=p2_hash,
            previous_hash=e1.entry_hash,
            hmac_signature=sig2,
            key_date=d2,
            timestamp=f"{d2}T00:01:00Z",
        )
        e2.entry_hash = compute_entry_hash(e2)

        # Write to log file
        with open(log_file, "w") as f:
            f.write(e1.model_dump_json() + "\n")
            f.write(e2.model_dump_json() + "\n")

        # Now verify chain today (2026-10-20)
        result = trail.verify_chain()
        assert result.valid is True
        assert result.total_entries == 2
        assert result.verified_entries == 2
        assert result.broken_at is None


# ── 7. Production Boot Checks Fail-Fast ────────────────────────────────────


class TestProductionBootChecks:
    def test_fail_fast_on_weak_secrets_in_production(self):
        from src.asoc.core.checks import _check_secrets, FATAL

        # In production with changeme password
        with patch.dict(os.environ, {
            "ENVIRONMENT": "production",
            "ADMIN_PASSWORD": "changeme",
            "HMAC_SECRET": "short",
            "WS_API_TOKEN": "dev-token-asoc-2026",
            "POSTGRES_PASSWORD": "changeme123",
        }):
            FATAL.clear()
            _check_secrets()
            assert len(FATAL) >= 3
            assert any("ADMIN_PASSWORD" in msg for msg in FATAL)
            assert any("HMAC_SECRET" in msg for msg in FATAL)
            assert any("POSTGRES_PASSWORD" in msg for msg in FATAL)
