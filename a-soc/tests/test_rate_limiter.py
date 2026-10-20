import pytest
from fastapi import HTTPException

from core.rate_limiter import TokenBucket, check_rate_limit


class TestTokenBucket:
    def test_consume_returns_true_when_tokens_available(self):
        bucket = TokenBucket(capacity=10, refill_rate=10, refill_interval=0.1)
        assert bucket.consume() is True

    def test_consume_returns_false_when_empty(self):
        bucket = TokenBucket(capacity=1, refill_rate=0, refill_interval=60)
        bucket.consume()
        assert bucket.consume() is False

    def test_refill_over_time(self):
        bucket = TokenBucket(capacity=10, refill_rate=10, refill_interval=0.01)
        for _ in range(10):
            bucket.consume()
        import time

        time.sleep(0.05)
        assert bucket.consume() is True


@pytest.mark.asyncio
async def test_rate_limiter_allows_request():
    from fastapi import Request

    scope = {"type": "http", "client": ("127.0.0.1", 50000)}
    req = Request(scope)
    result = await check_rate_limit(req)
    assert result is None
