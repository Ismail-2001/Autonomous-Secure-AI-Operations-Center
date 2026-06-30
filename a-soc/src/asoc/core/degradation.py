"""Graceful degradation patterns for external service failures.

Provides fallback strategies when dependencies are unavailable.
"""

from enum import Enum
from typing import Any, Callable, Coroutine, Optional


class DegradationStrategy(str, Enum):
    """Fallback strategies when a service is unavailable."""

    RETURN_DEFAULT = "return_default"
    RETURN_CACHED = "return_cached"
    SKIP = "skip"
    RAISE = "raise"


class GracefulDegradation:
    """Wrapper that applies degradation strategy on failure."""

    def __init__(
        self,
        name: str,
        strategy: DegradationStrategy = DegradationStrategy.RETURN_DEFAULT,
        default_value: Any = None,
        max_failures: int = 3,
    ) -> None:
        self.name = name
        self.strategy = strategy
        self.default_value = default_value
        self._failure_count = 0
        self._max_failures = max_failures
        self._circuit_open = False

    async def execute(
        self,
        func: Callable[..., Coroutine],
        *args: Any,
        **kwargs: Any,
    ) -> Any:
        """Execute function with degradation handling."""
        if self._circuit_open:
            return self._get_fallback()

        try:
            result = await func(*args, **kwargs)
            self._failure_count = 0
            return result
        except Exception as e:
            self._failure_count += 1
            if self._failure_count >= self._max_failures:
                self._circuit_open = True
            return self._get_fallback()

    def _get_fallback(self) -> Any:
        """Return fallback based on strategy."""
        if self.strategy == DegradationStrategy.RETURN_DEFAULT:
            return self.default_value
        elif self.strategy == DegradationStrategy.SKIP:
            return None
        elif self.strategy == DegradationStrategy.RAISE:
            raise RuntimeError(f"Service {self.name} unavailable (circuit open)")
        return self.default_value

    def reset(self) -> None:
        """Reset circuit breaker state."""
        self._failure_count = 0
        self._circuit_open = False

    @property
    def is_degraded(self) -> bool:
        return self._circuit_open
