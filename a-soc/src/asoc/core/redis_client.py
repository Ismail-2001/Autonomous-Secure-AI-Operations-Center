"""Redis client and token store helper for multi-worker distributed state.

Provides distributed storage for:
- Refresh token records (with reuse detection and token families)
- Ephemeral, single-use WebSocket authentication tickets
- Automatic fallback to in-memory storage when Redis is unavailable
"""

import asyncio
import json
import os
import secrets
import time
from typing import Any, Dict, Optional, Set

from src.asoc.core.config import settings
from src.asoc.core.logging import get_logger

logger = get_logger("asoc.core.redis_client")

_redis = None
_lock = asyncio.Lock()

# In-memory fallbacks when Redis is not available (e.g. unit tests)
_MEM_REFRESH_TOKENS: Dict[str, Dict[str, Any]] = {}
_MEM_USER_TOKENS: Dict[str, Set[str]] = {}
_MEM_WS_TICKETS: Dict[str, Dict[str, Any]] = {}


async def get_redis():
    """Get or initialize async Redis client."""
    global _redis
    if _redis is not None:
        return _redis

    async with _lock:
        if _redis is not None:
            return _redis
        try:
            import redis.asyncio as aioredis

            redis_url = os.getenv("REDIS_URL", settings.REDIS_URL or "redis://localhost:6379/0")
            client = aioredis.from_url(redis_url, decode_responses=True, socket_connect_timeout=1.5)
            # Test ping
            await client.ping()
            _redis = client
            logger.info("redis_client_connected", url=redis_url)
            return _redis
        except Exception as e:
            logger.debug("redis_connection_failed_fallback_to_memory", error=str(e))
            return None


# ── Refresh Token Management ────────────────────────────────────────────────


async def save_refresh_token(record: Dict[str, Any], ttl_seconds: int) -> None:
    """Save refresh token record in Redis (or in-memory fallback)."""
    jti = record["jti"]
    user_id = record["user_id"]
    r = await get_redis()
    if r:
        try:
            key = f"asoc:refresh:{jti}"
            user_key = f"asoc:user_tokens:{user_id}"
            await r.set(key, json.dumps(record), ex=ttl_seconds)
            await r.sadd(user_key, jti)
            await r.expire(user_key, ttl_seconds)
            return
        except Exception as e:
            logger.warning("save_refresh_token_redis_error", error=str(e))

    # In-memory fallback
    _MEM_REFRESH_TOKENS[jti] = record
    if user_id not in _MEM_USER_TOKENS:
        _MEM_USER_TOKENS[user_id] = set()
    _MEM_USER_TOKENS[user_id].add(jti)


async def get_refresh_token(jti: str) -> Optional[Dict[str, Any]]:
    """Fetch refresh token record by JTI."""
    r = await get_redis()
    if r:
        try:
            key = f"asoc:refresh:{jti}"
            raw = await r.get(key)
            if raw:
                return json.loads(raw)
        except Exception as e:
            logger.warning("get_refresh_token_redis_error", error=str(e))

    return _MEM_REFRESH_TOKENS.get(jti)


async def mark_refresh_token_revoked(jti: str, replaced_by: Optional[str] = None) -> bool:
    """Mark a refresh token as revoked."""
    record = await get_refresh_token(jti)
    if not record:
        return False

    record["revoked"] = True
    if replaced_by:
        record["replaced_by_jti"] = replaced_by

    r = await get_redis()
    if r:
        try:
            key = f"asoc:refresh:{jti}"
            ttl = await r.ttl(key)
            if ttl > 0:
                await r.set(key, json.dumps(record), ex=ttl)
            return True
        except Exception as e:
            logger.warning("revoke_refresh_token_redis_error", error=str(e))

    _MEM_REFRESH_TOKENS[jti] = record
    return True


async def revoke_all_tokens_for_user(user_id: str) -> None:
    """Revoke all active refresh tokens for a user (called upon token reuse detection)."""
    r = await get_redis()
    if r:
        try:
            user_key = f"asoc:user_tokens:{user_id}"
            jtis = await r.smembers(user_key)
            for jti in jtis:
                key = f"asoc:refresh:{jti}"
                raw = await r.get(key)
                if raw:
                    rec = json.loads(raw)
                    rec["revoked"] = True
                    ttl = await r.ttl(key)
                    if ttl > 0:
                        await r.set(key, json.dumps(rec), ex=ttl)
            logger.warning("all_user_tokens_revoked_in_redis", user_id=user_id, count=len(jtis))
            return
        except Exception as e:
            logger.warning("revoke_all_user_tokens_redis_error", error=str(e))

    # In-memory fallback
    jtis = _MEM_USER_TOKENS.get(user_id, set())
    for jti in jtis:
        if jti in _MEM_REFRESH_TOKENS:
            _MEM_REFRESH_TOKENS[jti]["revoked"] = True
    logger.warning("all_user_tokens_revoked_in_memory", user_id=user_id, count=len(jtis))


# ── WebSocket Ephemeral Tickets ─────────────────────────────────────────────


async def create_ws_ticket(user_id: str, role: str, ttl_seconds: int = 60) -> str:
    """Create a cryptographically random, single-use, 60s WebSocket ticket."""
    ticket = secrets.token_urlsafe(32)
    payload = {
        "user_id": user_id,
        "role": role,
        "created_at": time.time(),
        "expires_at": time.time() + ttl_seconds,
    }

    r = await get_redis()
    if r:
        try:
            key = f"asoc:ws_ticket:{ticket}"
            await r.set(key, json.dumps(payload), ex=ttl_seconds)
            return ticket
        except Exception as e:
            logger.warning("create_ws_ticket_redis_error", error=str(e))

    # In-memory fallback
    _MEM_WS_TICKETS[ticket] = payload
    return ticket


async def consume_ws_ticket(ticket: str) -> Optional[Dict[str, Any]]:
    """Verify and atomically consume (delete) a single-use WebSocket ticket."""
    if not ticket:
        return None

    r = await get_redis()
    if r:
        try:
            key = f"asoc:ws_ticket:{ticket}"
            # Use GETDEL for atomic single-use ticket consumption
            try:
                raw = await r.getdel(key)
            except AttributeError:
                # Older Redis versions without GETDEL: atomic pipeline
                pipe = r.pipeline()
                pipe.get(key)
                pipe.delete(key)
                res = await pipe.execute()
                raw = res[0]

            if raw:
                data = json.loads(raw)
                if data.get("expires_at", 0) >= time.time():
                    return data
            return None
        except Exception as e:
            logger.warning("consume_ws_ticket_redis_error", error=str(e))

    # In-memory fallback
    data = _MEM_WS_TICKETS.pop(ticket, None)
    if data and data.get("expires_at", 0) >= time.time():
        return data

    return None
