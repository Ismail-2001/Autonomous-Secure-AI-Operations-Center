"""Retry policies with exponential backoff and jitter.

Provides configurable retry strategies for transient failures.
"""

import asyncio
import random
from enum import Enum
from typing import Any, Callable, Coroutine, Optional, Type


class RetryStrategy(str, Enum):
    """Retry strategy types."""

    FIXED = "fixed"
    EXPONENTIAL = "exponential"
    LINEAR = "linear"


class RetryPolicy:
    """Configurable retry policy with backoff and jitter."""

    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        strategy: RetryStrategy = RetryStrategy.EXPONENTIAL,
        jitter: bool = True,
        retryable_exceptions: tuple = (Exception,),
    ) -> None:
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.strategy = strategy
        self.jitter = jitter
        self.retryable_exceptions = retryable_exceptions

    def _calculate_delay(self, attempt: int) -> float:
        """Calculate delay for the given attempt."""
        if self.strategy == RetryStrategy.FIXED:
            delay = self.base_delay
        elif self.strategy == RetryStrategy.EXPONENTIAL:
            delay = self.base_delay * (2 ** attempt)
        else:  # LINEAR
            delay = self.base_delay * (attempt + 1)

        delay = min(delay, self.max_delay)

        if self.jitter:
            delay = delay * (0.5 + random.random() * 0.5)

        return delay

    async def execute(
        self,
        func: Callable[..., Coroutine],
        *args: Any,
        **kwargs: Any,
    ) -> Any:
        """Execute function with retry logic."""
        last_exception = None

        for attempt in range(self.max_retries + 1):
            try:
                return await func(*args, **kwargs)
            except self.retryable_exceptions as e:
                last_exception = e
                if attempt < self.max_retries:
                    delay = self._calculate_delay(attempt)
                    await asyncio.sleep(delay)

        raise last_exception  # type: ignore

    @property
    def delay_table(self) -> list[float]:
        """Preview delay for each attempt."""
        return [
            min(
                self.base_delay * (2 ** i if self.strategy == RetryStrategy.EXPONENTIAL else i + 1),
                self.max_delay,
            )
            for i in range(self.max_retries)
        ]
