"""Structured audit logging for compliance and forensics.

Provides immutable audit log with tamper-evident chaining.
"""

import hashlib
import json
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class AuditLogEntry:
    """Single audit log entry."""

    entry_id: str
    timestamp: float
    event_type: str
    actor: str
    resource: str
    action: str
    outcome: str  # success, failure, denied
    metadata: Dict[str, Any] = field(default_factory=dict)
    previous_hash: Optional[str] = None
    entry_hash: Optional[str] = None

    def compute_hash(self) -> str:
        """Compute SHA-256 hash of entry content."""
        data = json.dumps({
            "entry_id": self.entry_id,
            "timestamp": self.timestamp,
            "event_type": self.event_type,
            "actor": self.actor,
            "resource": self.resource,
            "action": self.action,
            "outcome": self.outcome,
            "previous_hash": self.previous_hash,
        }, sort_keys=True)
        return hashlib.sha256(data.encode()).hexdigest()


class AuditLogger:
    """Immutable audit log with chain verification."""

    def __init__(self, max_entries: int = 100000) -> None:
        self._entries: List[AuditLogEntry] = []
        self._max_entries = max_entries

    def log(
        self,
        event_type: str,
        actor: str,
        resource: str,
        action: str,
        outcome: str = "success",
        **metadata: Any,
    ) -> AuditLogEntry:
        """Log an audit event."""
        import uuid

        previous_hash = self._entries[-1].entry_hash if self._entries else None

        entry = AuditLogEntry(
            entry_id=uuid.uuid4().hex[:12],
            timestamp=time.time(),
            event_type=event_type,
            actor=actor,
            resource=resource,
            action=action,
            outcome=outcome,
            metadata=metadata,
            previous_hash=previous_hash,
        )
        entry.entry_hash = entry.compute_hash()

        self._entries.append(entry)

        # Evict oldest if at capacity
        if len(self._entries) > self._max_entries:
            self._entries = self._entries[-self._max_entries:]

        return entry

    def verify_chain(self) -> bool:
        """Verify the integrity of the audit log chain."""
        for i, entry in enumerate(self._entries):
            if entry.entry_hash != entry.compute_hash():
                return False
            if i > 0 and entry.previous_hash != self._entries[i - 1].entry_hash:
                return False
        return True

    def get_entries(
        self,
        event_type: Optional[str] = None,
        actor: Optional[str] = None,
        limit: int = 100,
    ) -> List[AuditLogEntry]:
        """Query audit entries with optional filters."""
        results = self._entries
        if event_type:
            results = [e for e in results if e.event_type == event_type]
        if actor:
            results = [e for e in results if e.actor == actor]
        return results[-limit:]

    @property
    def count(self) -> int:
        return len(self._entries)


# Singleton
_audit_logger = AuditLogger()


def get_audit_logger() -> AuditLogger:
    return _audit_logger
