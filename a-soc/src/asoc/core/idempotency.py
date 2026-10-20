"""Idempotency and Action Deduplication Store.

Guarantees that irreversible or external actions (e.g. AWS host isolation,
firewall blocking, credential revocation, Slack/Teams notifications) are
executed EXACTLY ONCE per incident + action + parameter set, even when
workflows are retried or resumed from checkpoints.
"""

import hashlib
import json
import time
from typing import Any, Callable, Optional, Tuple

from src.asoc.core.logging import get_logger
from src.asoc.core.redis_client import get_redis

logger = get_logger("asoc.idempotency")

# In-memory fallback for local development or when Redis is offline
_in_memory_idempotency_store: dict[str, dict[str, Any]] = {}


def generate_idempotency_key(incident_id: str, action_name: str, params: Optional[dict[str, Any]] = None) -> str:
    """Generate a deterministic SHA-256 idempotency key for an action."""
    params = params or {}
    canonical_params = json.dumps(params, sort_keys=True, default=str)
    raw = f"{incident_id}:{action_name}:{canonical_params}"
    digest = hashlib.sha256(raw.encode()).hexdigest()
    return f"asoc:idemp:{digest}"


class IdempotencyManager:
    """Distributed idempotency manager with Redis backend and in-memory fallback."""

    def __init__(self, default_ttl_seconds: int = 86400):
        self.default_ttl = default_ttl_seconds

    async def acquire_lock(self, key: str, lock_ttl_seconds: int = 300) -> bool:
        """Attempt to acquire in-flight execution lock. Returns True if acquired."""
        r = get_redis()
        lock_key = f"{key}:lock"
        if r is not None:
            try:
                acquired = await r.set(lock_key, "IN_PROGRESS", nx=True, ex=lock_ttl_seconds)
                return bool(acquired)
            except Exception as e:
                logger.warning("redis_idempotency_lock_failed", error=str(e))

        # In-memory fallback
        now = time.time()
        record = _in_memory_idempotency_store.get(lock_key)
        if record:
            if record.get("expires_at", 0) > now:
                return False
        _in_memory_idempotency_store[lock_key] = {
            "status": "IN_PROGRESS",
            "expires_at": now + lock_ttl_seconds,
        }
        return True

    async def release_lock(self, key: str) -> None:
        """Release the in-flight lock (used if the operation failed and should be retriable)."""
        r = get_redis()
        lock_key = f"{key}:lock"
        if r is not None:
            try:
                await r.delete(lock_key)
            except Exception as e:
                logger.warning("redis_idempotency_release_failed", error=str(e))
        _in_memory_idempotency_store.pop(lock_key, None)

    async def check_executed(self, key: str) -> Tuple[bool, Optional[Any]]:
        """Check if action was already completed. Returns (is_completed, cached_result)."""
        r = get_redis()
        if r is not None:
            try:
                cached = await r.get(key)
                if cached is not None:
                    try:
                        data = json.loads(cached)
                        return True, data
                    except Exception:
                        return True, cached
            except Exception as e:
                logger.warning("redis_idempotency_check_failed", error=str(e))

        # In-memory fallback
        now = time.time()
        record = _in_memory_idempotency_store.get(key)
        if record:
            if record.get("expires_at", 0) > now:
                return True, record.get("result")
            else:
                _in_memory_idempotency_store.pop(key, None)
        return False, None

    async def mark_completed(self, key: str, result: Any, ttl_seconds: Optional[int] = None) -> None:
        """Record completed execution result and clear the in-flight lock."""
        ttl = ttl_seconds or self.default_ttl
        r = get_redis()
        serialized = json.dumps(result, default=str)

        if r is not None:
            try:
                await r.set(key, serialized, ex=ttl)
                await r.delete(f"{key}:lock")
                return
            except Exception as e:
                logger.warning("redis_idempotency_mark_failed", error=str(e))

        # In-memory fallback
        now = time.time()
        _in_memory_idempotency_store[key] = {
            "status": "COMPLETED",
            "result": result,
            "expires_at": now + ttl,
        }
        _in_memory_idempotency_store.pop(f"{key}:lock", None)


_manager: Optional[IdempotencyManager] = None


def get_idempotency_manager() -> IdempotencyManager:
    global _manager
    if _manager is None:
        _manager = IdempotencyManager()
    return _manager


async def execute_idempotent(
    incident_id: str,
    action_name: str,
    params: Optional[dict[str, Any]],
    func: Callable,
    *args,
    **kwargs,
) -> Tuple[bool, Any]:
    """Execute an action with strict idempotency semantics.

    Returns:
        (was_executed_now, result)
        If was_executed_now is False, result contains the previously cached outcome.
    """
    key = generate_idempotency_key(incident_id, action_name, params)
    manager = get_idempotency_manager()

    # 1. Check if already executed
    already_done, previous_result = await manager.check_executed(key)
    if already_done:
        logger.info(
            "idempotent_action_skipped_already_executed",
            incident_id=incident_id,
            action_name=action_name,
            key=key,
        )
        return False, previous_result

    # 2. Acquire in-flight lock
    acquired = await manager.acquire_lock(key)
    if not acquired:
        logger.warning(
            "idempotent_action_concurrent_in_progress",
            incident_id=incident_id,
            action_name=action_name,
        )
        # Another worker is currently executing this action
        return False, {"status": "in_progress", "detail": "Action concurrently executing"}

    # 3. Execute function
    try:
        import inspect

        if inspect.iscoroutinefunction(func):
            result = await func(*args, **kwargs)
        else:
            result = func(*args, **kwargs)

        await manager.mark_completed(key, result)
        logger.info(
            "idempotent_action_completed",
            incident_id=incident_id,
            action_name=action_name,
        )
        return True, result
    except Exception as e:
        logger.error(
            "idempotent_action_execution_failed",
            incident_id=incident_id,
            action_name=action_name,
            error=str(e),
        )
        # Release lock so it may be retried
        await manager.release_lock(key)
        raise
