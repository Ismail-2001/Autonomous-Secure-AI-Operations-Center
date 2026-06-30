"""Event deduplication for threat events.

Prevents duplicate processing of the same threat event.
"""

import hashlib
import time
from typing import Dict, Optional


class EventDeduplicator:
    """Time-window based event deduplication."""

    def __init__(self, window_seconds: float = 300.0, max_entries: int = 10000) -> None:
        self._seen: Dict[str, float] = {}
        self._window = window_seconds
        self._max_entries = max_entries

    def _make_key(self, event_type: str, source: str, details: str = "") -> str:
        """Create a deduplication key from event attributes."""
        raw = f"{event_type}:{source}:{details}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def is_duplicate(self, event_type: str, source: str, details: str = "") -> bool:
        """Check if an event is a duplicate within the time window."""
        self._cleanup()

        key = self._make_key(event_type, source, details)
        now = time.time()

        if key in self._seen:
            if now - self._seen[key] < self._window:
                return True
            # Outside window, allow and update timestamp

        self._seen[key] = now

        # Evict oldest if at capacity
        if len(self._seen) > self._max_entries:
            oldest_key = min(self._seen, key=self._seen.get)
            del self._seen[oldest_key]

        return False

    def _cleanup(self) -> None:
        """Remove entries older than the time window."""
        now = time.time()
        expired = [
            key for key, ts in self._seen.items()
            if now - ts > self._window
        ]
        for key in expired:
            del self._seen[key]

    @property
    def size(self) -> int:
        return len(self._seen)

    def clear(self) -> None:
        self._seen.clear()


# Singleton
_deduplicator = EventDeduplicator()


def get_deduplicator() -> EventDeduplicator:
    return _deduplicator
