"""Cryptographic password hashing and verification module.

Primary algorithm: Argon2id (via argon2-cffi)
Fallback: PBKDF2-HMAC-SHA256 (600,000 iterations per OWASP recommendations)
Provides constant-time verification to prevent timing attacks.
"""

import base64
import hashlib
import hmac
import os
import secrets
from typing import Optional

from src.asoc.core.logging import get_logger

logger = get_logger("asoc.auth.passwords")

# Try importing argon2-cffi
try:
    from argon2 import PasswordHasher
    from argon2.exceptions import VerifyMismatchError

    _argon2_hasher: Optional[PasswordHasher] = PasswordHasher(
        time_cost=2,
        memory_cost=65536,  # 64 MB
        parallelism=1,
        hash_len=32,
    )
except ImportError:
    _argon2_hasher = None
    logger.warning("argon2_cffi_not_available_using_pbkdf2_fallback")


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id, falling back to PBKDF2-SHA256."""
    if not password:
        raise ValueError("Password cannot be empty")

    if _argon2_hasher is not None:
        try:
            return _argon2_hasher.hash(password)
        except Exception as e:
            logger.warning("argon2_hashing_failed_fallback", error=str(e))

    # PBKDF2 fallback
    salt = secrets.token_bytes(16)
    iterations = 600_000
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    salt_b64 = base64.b64encode(salt).decode("ascii")
    derived_b64 = base64.b64encode(derived).decode("ascii")
    return f"$pbkdf2-sha256${iterations}${salt_b64}${derived_b64}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against Argon2id or PBKDF2-SHA256 hash in constant time."""
    if not plain_password or not hashed_password:
        return False

    # Check for Argon2 hash ($argon2id$...)
    if hashed_password.startswith("$argon2"):
        if _argon2_hasher is not None:
            try:
                return _argon2_hasher.verify(hashed_password, plain_password)
            except VerifyMismatchError:
                return False
            except Exception as e:
                logger.error("argon2_verify_error", error=str(e))
                return False
        else:
            logger.error("cannot_verify_argon2_hash_without_argon2_cffi")
            return False

    # Check for PBKDF2 hash ($pbkdf2-sha256$iterations$salt$hash)
    if hashed_password.startswith("$pbkdf2-sha256$"):
        try:
            parts = hashed_password.split("$")
            if len(parts) != 5:
                return False
            iterations = int(parts[2])
            salt = base64.b64decode(parts[3].encode("ascii"))
            expected_derived = base64.b64decode(parts[4].encode("ascii"))
            actual_derived = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, iterations)
            return hmac.compare_digest(actual_derived, expected_derived)
        except Exception as e:
            logger.error("pbkdf2_verify_error", error=str(e))
            return False

    # Legacy SHA-256 fallback (e.g. for simple dev seeds)
    if hashed_password.startswith("sha256$"):
        parts = hashed_password.split("$")
        if len(parts) == 3:
            salt = parts[1].encode("utf-8")
            expected = parts[2]
            actual = hashlib.sha256(salt + plain_password.encode("utf-8")).hexdigest()
            return hmac.compare_digest(actual, expected)

    return False
