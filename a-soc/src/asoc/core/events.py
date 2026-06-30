"""Event emitter for decoupled component communication.

Provides publish/subscribe pattern for internal event handling.
"""

import asyncio
from collections import defaultdict
from typing import Any, Callable, Coroutine, Dict, List, Optional


class EventEmitter:
    """Async event emitter with topic-based pub/sub."""

    def __init__(self) -> None:
        self._listeners: Dict[str, List[Callable[..., Coroutine]]] = defaultdict(list)
        self._once_listeners: Dict[str, List[Callable[..., Coroutine]]] = defaultdict(list)

    def on(self, event: str, callback: Callable[..., Coroutine]) -> None:
        """Register a listener for an event."""
        self._listeners[event].append(callback)

    def once(self, event: str, callback: Callable[..., Coroutine]) -> None:
        """Register a one-time listener for an event."""
        self._once_listeners[event].append(callback)

    def off(self, event: str, callback: Optional[Callable[..., Coroutine]] = None) -> None:
        """Remove listener(s) for an event."""
        if callback is None:
            self._listeners.pop(event, None)
            self._once_listeners.pop(event, None)
        else:
            if event in self._listeners:
                self._listeners[event] = [
                    cb for cb in self._listeners[event] if cb != callback
                ]
            if event in self._once_listeners:
                self._once_listeners[event] = [
                    cb for cb in self._once_listeners[event] if cb != callback
                ]

    async def emit(self, event: str, *args: Any, **kwargs: Any) -> None:
        """Emit an event to all listeners."""
        # Regular listeners
        for callback in self._listeners.get(event, []):
            try:
                await callback(*args, **kwargs)
            except Exception:
                pass

        # One-time listeners
        once = self._once_listeners.pop(event, [])
        for callback in once:
            try:
                await callback(*args, **kwargs)
            except Exception:
                pass

    def listener_count(self, event: str) -> int:
        """Get the number of listeners for an event."""
        return len(self._listeners.get(event, [])) + len(self._once_listeners.get(event, []))

    def event_names(self) -> List[str]:
        """Get all registered event names."""
        names = set(self._listeners.keys())
        names.update(self._once_listeners.keys())
        return list(names)


# Singleton
_emitter = EventEmitter()


def get_event_emitter() -> EventEmitter:
    return _emitter
