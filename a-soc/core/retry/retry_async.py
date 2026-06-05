import asyncio
import random
from functools import wraps
from typing import Any, Callable, List, Optional, Type, Union

from core.logging import get_logger

logger = get_logger("asoc.retry")


async def async_retry(
    coro_factory: Callable,
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    backoff: float = 2.0,
    jitter: bool = True,
    exceptions: tuple = (Exception,),
) -> Any:
    last_exc = None
    for attempt in range(max_retries + 1):
        try:
            return await coro_factory()
        except exceptions as e:
            last_exc = e
            if attempt < max_retries:
                delay = min(base_delay * (backoff ** attempt), max_delay)
                if jitter:
                    delay *= random.uniform(0.8, 1.2)
                logger.warning(
                    "retry_attempt",
                    attempt=attempt + 1,
                    max_retries=max_retries,
                    delay=round(delay, 2),
                    error=str(e),
                )
                await asyncio.sleep(delay)
            else:
                logger.error("retry_exhausted", max_retries=max_retries, error=str(e))
                raise


def retry(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    backoff: float = 2.0,
    jitter: bool = True,
    exceptions: tuple = (Exception,),
):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            async def _call():
                return await func(*args, **kwargs)
            return await async_retry(
                _call,
                max_retries=max_retries,
                base_delay=base_delay,
                max_delay=max_delay,
                backoff=backoff,
                jitter=jitter,
                exceptions=exceptions,
            )
        return wrapper
    return decorator
