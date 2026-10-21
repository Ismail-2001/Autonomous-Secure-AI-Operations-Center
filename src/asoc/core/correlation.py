"""Correlation ID tracking for distributed tracing.

Generates and propagates correlation IDs across agent interactions.
"""

import uuid
from contextvars import ContextVar
from typing import Optional

# Context variable for request-scoped correlation ID
_correlation_id: ContextVar[Optional[str]] = ContextVar("correlation_id", default=None)
_incident_id: ContextVar[Optional[str]] = ContextVar("incident_id", default=None)
_agent_id: ContextVar[Optional[str]] = ContextVar("agent_id", default=None)


def generate_correlation_id() -> str:
    """Generate a new unique correlation ID."""
    return uuid.uuid4().hex[:16]


def set_correlation_id(correlation_id: str) -> None:
    """Set the current correlation ID."""
    _correlation_id.set(correlation_id)


def get_correlation_id() -> str:
    """Get the current correlation ID, generating one if needed."""
    cid = _correlation_id.get()
    if cid is None:
        cid = generate_correlation_id()
        _correlation_id.set(cid)
    return cid


def set_incident_context(incident_id: str) -> None:
    """Set the current incident ID."""
    _incident_id.set(incident_id)


def get_incident_context() -> Optional[str]:
    """Get the current incident ID."""
    return _incident_id.get()


def set_agent_context(agent_id: str) -> None:
    """Set the current agent ID."""
    _agent_id.set(agent_id)


def get_agent_context() -> Optional[str]:
    """Get the current agent ID."""
    return _agent_id.get()


def clear_context() -> None:
    """Clear all context variables."""
    _correlation_id.set(None)
    _incident_id.set(None)
    _agent_id.set(None)


def get_trace_context() -> dict:
    """Get all trace context as a dictionary for logging/propagation."""
    return {
        "correlation_id": get_correlation_id(),
        "incident_id": get_incident_context(),
        "agent_id": get_agent_context(),
    }
