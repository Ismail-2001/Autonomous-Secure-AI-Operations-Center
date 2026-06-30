"""Incident lifecycle management.

Tracks incident state from creation through resolution.
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional


class IncidentSeverity(str, Enum):
    """Incident severity levels."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class IncidentStatus(str, Enum):
    """Incident lifecycle status."""

    NEW = "new"
    TRIAGED = "triaged"
    INVESTIGATING = "investigating"
    CONTAINING = "containing"
    ERADICATING = "eradicating"
    RECOVERING = "recovering"
    RESOLVED = "resolved"
    POST_INCIDENT = "post_incident"


@dataclass
class IncidentTimeline:
    """Timeline entry for incident history."""

    timestamp: str
    event: str
    agent_id: Optional[str] = None
    details: Dict = field(default_factory=dict)


@dataclass
class Incident:
    """Incident tracking through its lifecycle."""

    incident_id: str = field(default_factory=lambda: str(uuid.uuid4())[:12])
    title: str = ""
    description: str = ""
    severity: IncidentSeverity = IncidentSeverity.MEDIUM
    status: IncidentStatus = IncidentStatus.NEW
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    resolved_at: Optional[str] = None
    assigned_agent: Optional[str] = None
    risk_score: float = 0.0
    confidence_score: float = 0.0
    affected_assets: List[str] = field(default_factory=list)
    timeline: List[IncidentTimeline] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)

    def transition(self, new_status: IncidentStatus, agent_id: Optional[str] = None) -> None:
        """Transition to a new status and record the event."""
        self.status = new_status
        self.updated_at = datetime.now(timezone.utc).isoformat()
        self.timeline.append(
            IncidentTimeline(
                timestamp=self.updated_at,
                event=f"status_transition:{new_status.value}",
                agent_id=agent_id,
            )
        )
        if new_status == IncidentStatus.RESOLVED:
            self.resolved_at = self.updated_at

    @property
    def is_active(self) -> bool:
        return self.status not in (IncidentStatus.RESOLVED, IncidentStatus.POST_INCIDENT)

    @property
    def age_hours(self) -> float:
        created = datetime.fromisoformat(self.created_at)
        now = datetime.now(timezone.utc)
        return (now - created).total_seconds() / 3600


class IncidentManager:
    """In-memory incident store for development."""

    def __init__(self) -> None:
        self._incidents: Dict[str, Incident] = {}

    def create(self, title: str, description: str = "", severity: IncidentSeverity = IncidentSeverity.MEDIUM) -> Incident:
        incident = Incident(title=title, description=description, severity=severity)
        self._incidents[incident.incident_id] = incident
        return incident

    def get(self, incident_id: str) -> Optional[Incident]:
        return self._incidents.get(incident_id)

    def list_active(self) -> List[Incident]:
        return [i for i in self._incidents.values() if i.is_active]

    def list_all(self) -> List[Incident]:
        return list(self._incidents.values())


# Singleton
_incident_manager = IncidentManager()


def get_incident_manager() -> IncidentManager:
    return _incident_manager
