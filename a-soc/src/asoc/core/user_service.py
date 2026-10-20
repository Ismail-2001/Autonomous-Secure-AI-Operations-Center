"""User management and persistence service.

Handles user retrieval, creation, credential verification, lockout tracking,
and first-boot admin user initialization.
"""

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

from src.asoc.core.config import settings
from src.asoc.core.jwt_handler import Role
from src.asoc.core.logging import get_logger
from src.asoc.core.passwords import hash_password, verify_password

logger = get_logger("asoc.auth.user_service")

# In-memory user store for dev / fallback / isolated unit tests
_IN_MEMORY_USERS: Dict[str, Dict[str, Any]] = {}

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15


async def _get_db_conn():
    try:
        from src.asoc.core.connection import get_db_pool

        pool = await get_db_pool()
        return await pool.pool.acquire(), pool
    except Exception as e:
        logger.debug("database_unavailable_using_memory_user_store", error=str(e))
        return None, None


async def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Retrieve user record by username."""
    conn, pool = await _get_db_conn()
    if conn:
        try:
            row = await conn.fetchrow(
                """
                SELECT id, username, role, password_hash, failed_login_count, locked_until, is_active, created_at, last_login
                FROM users
                WHERE username = $1
            """,
                username,
            )
            if row:
                return dict(row)
        except Exception as e:
            logger.warning("get_user_db_failed_fallback_memory", error=str(e))
        finally:
            await pool.pool.release(conn)

    return _IN_MEMORY_USERS.get(username)


async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve user record by user ID."""
    conn, pool = await _get_db_conn()
    if conn:
        try:
            row = await conn.fetchrow(
                """
                SELECT id, username, role, password_hash, failed_login_count, locked_until, is_active, created_at, last_login
                FROM users
                WHERE id = $1
            """,
                user_id,
            )
            if row:
                return dict(row)
        except Exception as e:
            logger.warning("get_user_by_id_db_failed_fallback_memory", error=str(e))
        finally:
            await pool.pool.release(conn)

    for u in _IN_MEMORY_USERS.values():
        if u.get("id") == user_id:
            return u
    return None


async def create_user(
    username: str,
    password: str,
    role: Role = Role.ANALYST,
    client_id: str = "default",
    is_active: bool = True,
) -> Dict[str, Any]:
    """Create a new user with Argon2id hashed password."""
    now = datetime.now(timezone.utc)
    user_id = str(uuid.uuid4())
    pw_hash = hash_password(password)

    conn, pool = await _get_db_conn()
    if conn:
        try:
            await conn.execute(
                """
                INSERT INTO users (id, user_id, username, role, client_id, password_hash, failed_login_count, is_active, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, $8)
            """,
                user_id,
                username,
                username,
                role.value,
                client_id,
                pw_hash,
                is_active,
                now,
            )
        except Exception as e:
            logger.warning("create_user_db_failed_falling_back_to_memory", error=str(e))
        finally:
            await pool.pool.release(conn)

    user_record = {
        "id": user_id,
        "username": username,
        "role": role.value,
        "password_hash": pw_hash,
        "failed_login_count": 0,
        "locked_until": None,
        "is_active": is_active,
        "created_at": now,
        "last_login": None,
    }
    _IN_MEMORY_USERS[username] = user_record
    logger.info("user_created", username=username, role=role.value)
    return user_record


def is_user_locked(user: Dict[str, Any]) -> Tuple[bool, Optional[int]]:
    """Check if user account is locked. Returns (is_locked, remaining_seconds)."""
    locked_until = user.get("locked_until")
    if not locked_until:
        return False, None

    if isinstance(locked_until, str):
        try:
            locked_until = datetime.fromisoformat(locked_until.replace("Z", "+00:00"))
        except ValueError:
            return False, None

    now = datetime.now(timezone.utc)
    if locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=timezone.utc)

    if locked_until > now:
        remaining = int((locked_until - now).total_seconds())
        return True, remaining

    return False, None


async def record_login_failure(username: str) -> Tuple[int, Optional[datetime]]:
    """Increment failed login attempts and apply 15-minute lockout if >= MAX_LOGIN_ATTEMPTS."""
    now = datetime.now(timezone.utc)
    user = await get_user_by_username(username)
    current_fails = (user.get("failed_login_count") or 0) + 1 if user else 1
    locked_until = None

    if current_fails >= MAX_LOGIN_ATTEMPTS:
        locked_until = now + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        logger.warning(
            "user_locked_out",
            username=username,
            failed_count=current_fails,
            lockout_minutes=LOCKOUT_DURATION_MINUTES,
        )

    conn, pool = await _get_db_conn()
    if conn:
        try:
            await conn.execute(
                """
                UPDATE users
                SET failed_login_count = $1, locked_until = $2, updated_at = $3
                WHERE username = $4
            """,
                current_fails,
                locked_until,
                now,
                username,
            )
        except Exception as e:
            logger.warning("record_login_failure_db_error", error=str(e))
        finally:
            await pool.pool.release(conn)

    if username in _IN_MEMORY_USERS:
        _IN_MEMORY_USERS[username]["failed_login_count"] = current_fails
        _IN_MEMORY_USERS[username]["locked_until"] = locked_until

    return current_fails, locked_until


async def record_login_success(username: str) -> None:
    """Reset failed login count and lockout timer on successful login."""
    now = datetime.now(timezone.utc)
    conn, pool = await _get_db_conn()
    if conn:
        try:
            await conn.execute(
                """
                UPDATE users
                SET failed_login_count = 0, locked_until = NULL, last_login = $1, updated_at = $1
                WHERE username = $2
            """,
                now,
                username,
            )
        except Exception as e:
            logger.warning("record_login_success_db_error", error=str(e))
        finally:
            await pool.pool.release(conn)

    if username in _IN_MEMORY_USERS:
        _IN_MEMORY_USERS[username]["failed_login_count"] = 0
        _IN_MEMORY_USERS[username]["locked_until"] = None
        _IN_MEMORY_USERS[username]["last_login"] = now


async def seed_admin_user_if_needed() -> Optional[Dict[str, Any]]:
    """Seed initial admin user on first boot if no admin exists."""
    admin_username = os.getenv("ADMIN_USERNAME", settings.ADMIN_USERNAME or "admin")
    existing = await get_user_by_username(admin_username)
    if existing:
        logger.info("admin_user_already_exists", username=admin_username)
        return existing

    admin_pw = None
    if settings.ADMIN_PASSWORD:
        admin_pw = settings.ADMIN_PASSWORD.get_secret_value()
    elif os.getenv("ADMIN_PASSWORD"):
        admin_pw = os.getenv("ADMIN_PASSWORD")

    env = os.getenv("ENVIRONMENT", settings.ENVIRONMENT).lower()
    if not admin_pw:
        if env in ("production", "prod"):
            raise RuntimeError(
                "CRITICAL: ADMIN_PASSWORD must be configured in production environment for initial user seeding."
            )
        admin_pw = "AdminDevSecure2026!"
        logger.warning(
            "seeding_default_admin_password_dev_only",
            username=admin_username,
            password_preview="AdminDevSecure2026!",
        )

    admin_user = await create_user(
        username=admin_username,
        password=admin_pw,
        role=Role.ADMIN,
        client_id="system-seed",
    )
    logger.info("admin_user_seeded_successfully", username=admin_username)
    return admin_user
