"""E2E test: Rate limiting degrades gracefully under load."""
import asyncio
import time

import pytest


@pytest.mark.e2e
class TestRateLimitDegradation:
    """Verify the system degrades gracefully when rate limits are hit."""

    async def test_rate_limiter_allows_burst_within_capacity(self):
        from src.asoc.core.rate_limiter import TokenBucket

        bucket = TokenBucket(capacity=10, refill_rate=100)
        results = []
        for _ in range(10):
            results.append(await bucket.acquire())
        assert all(results)

    async def test_rate_limiter_rejects_over_capacity(self):
        from src.asoc.core.rate_limiter import TokenBucket

        bucket = TokenBucket(capacity=3, refill_rate=0)
        for _ in range(3):
            await bucket.acquire()
        result = await bucket.acquire()
        assert result is False

    async def test_agent_continues_after_rate_limit_hit(self, setup_test_state):
        from src.asoc.agents.telemetry import TelemetryAgent

        incident_id = str(uuid.uuid4())
        state = setup_test_state(incident_id)

        telemetry = TelemetryAgent()
        for _ in range(3):
            state = await telemetry.run_cycle(state)

        assert len(state.get("agent_observations", [])) == 3
