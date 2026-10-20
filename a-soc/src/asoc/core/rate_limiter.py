import time
from collections import defaultdict
from typing import Dict, List, Tuple

from fastapi import HTTPException, Request, status


class TokenBucket:
    def __init__(self, capacity: int = 60, refill_rate: float = 1.0, refill_interval: float = 1.0):
        self._capacity = float(capacity)
        self._tokens = float(capacity)
        self._refill_rate = refill_rate
        self._refill_interval = refill_interval
        self._last_refill = time.monotonic()

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_refill
        if elapsed >= self._refill_interval:
            tokens_to_add = (elapsed / self._refill_interval) * self._refill_rate
            self._tokens = min(self._capacity, self._tokens + tokens_to_add)
            self._last_refill = now

    def consume(self, tokens: float = 1.0) -> bool:
        self._refill()
        if self._tokens >= tokens:
            self._tokens -= tokens
            return True
        return False


class RateLimiter:
    def __init__(self, capacity: int = 60, refill_rate: float = 1.0, refill_interval: float = 1.0):
        self._buckets: Dict[str, Tuple[TokenBucket, float]] = defaultdict(
            lambda: (TokenBucket(capacity, refill_rate, refill_interval), time.monotonic())
        )
        self._cleanup_interval = 300.0

    async def check(self, request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        bucket, created_at = self._buckets[client_ip]
        if not bucket.consume():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Try again later.",
            )
        now = time.monotonic()
        if now - created_at > self._cleanup_interval:
            self._buckets.pop(client_ip, None)


_global_limiter = RateLimiter(capacity=120, refill_rate=2.0)


async def check_rate_limit(request: Request) -> None:
    await _global_limiter.check(request)
