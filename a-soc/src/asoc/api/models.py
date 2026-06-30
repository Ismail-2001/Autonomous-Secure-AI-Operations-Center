"""Request/response models for the A-SOC API.

These Pydantic models define the wire format for all API endpoints.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class HealthStatus(str, Enum):
    """Health check status values."""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


class HealthResponse(BaseModel):
    """Response model for /health endpoint."""

    status: HealthStatus
    version: str
    uptime_seconds: float
    database: str = "connected"
    redis: str = "connected"
    opa: str = "connected"


class SimulationStart(BaseModel):
    """Request to start a threat simulation."""

    scenario: Optional[str] = Field(None, max_length=100, description="Scenario template to simulate")


class ApprovalAction(BaseModel):
    """Human approval/denial of a response action."""

    incident_id: str = Field(..., min_length=1, max_length=64)
    approved: bool = True


class HuntingQuery(BaseModel):
    """Threat hunting query parameters."""

    q: str = Field(default="", max_length=500, description="Free-text search query")
    source: str = Field(default="", max_length=100, description="Event source filter")
    event_type: str = Field(default="", max_length=50, description="Event type filter")
    start_time: str = Field(default="", max_length=30, description="ISO timestamp start")
    end_time: str = Field(default="", max_length=30, description="ISO timestamp end")
    limit: int = Field(default=50, ge=1, le=500, description="Max results")
    offset: int = Field(default=0, ge=0, description="Result offset for pagination")


class TokenIssueRequest(BaseModel):
    """Request to issue a new JWT token pair."""

    user_id: str = Field(..., min_length=1, max_length=128)
    role: str = Field(
        default="analyst",
        pattern="^(readonly|analyst|supervisor|admin)$",
        description="User role for RBAC",
    )
    client_id: str = Field(default="default", max_length=128)


class TokenRefreshRequest(BaseModel):
    """Request to refresh an access token."""

    refresh_token: str = Field(..., min_length=1)
    client_id: str = Field(default="default", max_length=128)


class TokenResponse(BaseModel):
    """JWT token pair response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access token TTL in seconds")


class AuditEntry(BaseModel):
    """Audit trail entry."""

    entry_id: str
    timestamp: str
    agent_id: str
    action: str
    payload_hash: str
    signature: str
    previous_hash: Optional[str] = None


class AuditVerifyResponse(BaseModel):
    """Response for audit chain verification."""

    valid: bool
    total_entries: int
    broken_at: Optional[int] = None
    message: str


class RateLimitStats(BaseModel):
    """Per-agent rate limit statistics."""

    agents: Dict[str, Dict[str, Any]]
    ip_buckets: int
    endpoint_buckets: int


class ThreatEvent(BaseModel):
    """Real-time threat event for WebSocket feed."""

    event_id: str
    timestamp: str
    agent_id: str
    event_type: str
    severity: str
    source: str
    details: Dict[str, Any] = Field(default_factory=dict)


class BlastRadiusNode(BaseModel):
    """Node in the blast radius graph."""

    id: str
    label: str
    type: str  # asset, threat, impact
    risk_score: float = 0.0


class BlastRadiusEdge(BaseModel):
    """Edge in the blast radius graph."""

    source: str
    target: str
    relationship: str


class BlastRadiusGraph(BaseModel):
    """Blast radius visualization data."""

    nodes: List[BlastRadiusNode]
    edges: List[BlastRadiusEdge]
    center_incident_id: str


class AgentStatus(BaseModel):
    """Current status of an agent."""

    agent_id: str
    agent_type: str
    status: str  # idle, processing, error
    last_activity: Optional[str] = None
    tasks_completed: int = 0
    error_count: int = 0
