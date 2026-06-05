import pytest

from core.circuit_breaker import CircuitBreaker, CircuitBreakerOpenError


@pytest.mark.asyncio
async def test_closed_state_initially():
    cb = CircuitBreaker("test", failure_threshold=2, recovery_timeout=0.5)
    assert cb.state.value == "closed"


@pytest.mark.asyncio
async def test_opens_after_threshold_failures():
    cb = CircuitBreaker("test", failure_threshold=2, recovery_timeout=5.0)
    for i in range(2):
        try:
            async with cb:
                raise ValueError("fail")
        except ValueError:
            pass
    assert cb.state.value == "open"


@pytest.mark.asyncio
async def test_allows_through_when_closed():
    cb = CircuitBreaker("test", failure_threshold=2, recovery_timeout=5.0)
    async with cb:
        pass
    assert cb.state.value == "closed"


@pytest.mark.asyncio
async def test_raises_open_error_when_open():
    cb = CircuitBreaker("test", failure_threshold=1, recovery_timeout=5.0)
    try:
        async with cb:
            raise ValueError("fail")
    except ValueError:
        pass
    with pytest.raises(CircuitBreakerOpenError):
        async with cb:
            pass


@pytest.mark.asyncio
async def test_half_open_after_timeout():
    cb = CircuitBreaker("test", failure_threshold=1, recovery_timeout=0.1)
    try:
        async with cb:
            raise ValueError("fail")
    except ValueError:
        pass
    import asyncio

    await asyncio.sleep(0.15)
    async with cb:
        pass
    assert cb.state.value == "closed"


@pytest.mark.asyncio
async def test_call_success():
    cb = CircuitBreaker("test")
    result = await cb.call(lambda: "done")
    assert result == "done"


@pytest.mark.asyncio
async def test_call_with_fallback():
    cb = CircuitBreaker("test", failure_threshold=1, recovery_timeout=5.0)
    try:
        async with cb:
            raise ValueError("fail")
    except ValueError:
        pass
    result = await cb.call(lambda: (_ for _ in ()).throw(ValueError("fail")), fallback=lambda: "fallback")
    assert result == "fallback"


@pytest.mark.asyncio
async def test_breaker_name():
    cb = CircuitBreaker("my-breaker")
    assert cb.name == "my-breaker"
