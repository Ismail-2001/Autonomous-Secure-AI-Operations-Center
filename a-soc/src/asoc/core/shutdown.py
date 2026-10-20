"""Graceful shutdown handler for A-SOC services.

Ensures clean resource cleanup when services stop.
"""

import asyncio
import signal
import sys
from typing import Callable, Coroutine, List, Optional


class ShutdownHandler:
    """Coordinates graceful shutdown of async services."""

    def __init__(self) -> None:
        self._cleanup_callbacks: List[Callable[[], Coroutine]] = []
        self._shutdown_event = asyncio.Event()
        self._handlers_registered = False

    def register_cleanup(self, callback: Callable[[], Coroutine]) -> None:
        """Register an async cleanup callback."""
        self._cleanup_callbacks.append(callback)

    def register_signal_handlers(self) -> None:
        """Register signal handlers for graceful shutdown."""
        if self._handlers_registered:
            return

        if sys.platform != "win32":
            loop = asyncio.get_event_loop()
            for sig in (signal.SIGTERM, signal.SIGINT):
                loop.add_signal_handler(sig, self._signal_handler)
            self._handlers_registered = True

    def _signal_handler(self) -> None:
        """Handle shutdown signal."""
        self._shutdown_event.set()

    async def shutdown(self) -> None:
        """Execute all cleanup callbacks."""
        for callback in reversed(self._cleanup_callbacks):
            try:
                await asyncio.wait_for(callback(), timeout=10.0)
            except asyncio.TimeoutError:
                pass
            except Exception:
                pass
        self._cleanup_callbacks.clear()

    async def wait_for_shutdown(self) -> None:
        """Wait for shutdown signal."""
        await self._shutdown_event.wait()

    @property
    def is_shutting_down(self) -> bool:
        return self._shutdown_event.is_set()


# Singleton
_shutdown_handler = ShutdownHandler()


def get_shutdown_handler() -> ShutdownHandler:
    return _shutdown_handler
