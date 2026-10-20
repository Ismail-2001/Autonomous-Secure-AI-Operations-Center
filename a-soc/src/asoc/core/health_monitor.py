"""Agent health monitoring and status tracking."""

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Optional


class AgentHealthStatus(str, Enum):
    """Agent health status values."""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


@dataclass
class AgentHealth:
    """Health state for a single agent."""

    agent_id: str
    agent_type: str
    status: AgentHealthStatus = AgentHealthStatus.UNKNOWN
    last_heartbeat: float = field(default_factory=time.monotonic)
    last_activity: Optional[str] = None
    tasks_completed: int = 0
    tasks_failed: int = 0
    error_count: int = 0
    avg_response_ms: float = 0.0

    @property
    def is_healthy(self) -> bool:
        return self.status == AgentHealthStatus.HEALTHY

    @property
    def failure_rate(self) -> float:
        total = self.tasks_completed + self.tasks_failed
        if total == 0:
            return 0.0
        return self.tasks_failed / total

    def record_success(self, response_ms: float) -> None:
        """Record a successful task completion."""
        self.tasks_completed += 1
        self.last_heartbeat = time.monotonic()
        # Exponential moving average
        self.avg_response_ms = 0.7 * self.avg_response_ms + 0.3 * response_ms
        self.status = AgentHealthStatus.HEALTHY

    def record_failure(self) -> None:
        """Record a task failure."""
        self.tasks_failed += 1
        self.error_count += 1
        self.last_heartbeat = time.monotonic()
        if self.error_count >= 5:
            self.status = AgentHealthStatus.UNHEALTHY
        elif self.error_count >= 2:
            self.status = AgentHealthStatus.DEGRADED


class AgentHealthMonitor:
    """Track health status across all agents."""

    def __init__(self, stale_threshold_seconds: float = 60.0) -> None:
        self._agents: Dict[str, AgentHealth] = {}
        self._stale_threshold = stale_threshold_seconds

    def register(self, agent_id: str, agent_type: str) -> AgentHealth:
        """Register an agent for health monitoring."""
        health = AgentHealth(agent_id=agent_id, agent_type=agent_type)
        self._agents[agent_id] = health
        return health

    def get(self, agent_id: str) -> Optional[AgentHealth]:
        return self._agents.get(agent_id)

    def check_stale(self) -> list[str]:
        """Return IDs of agents that haven't sent a heartbeat recently."""
        now = time.monotonic()
        stale = []
        for agent_id, health in self._agents.items():
            if now - health.last_heartbeat > self._stale_threshold:
                stale.append(agent_id)
        return stale

    def get_all_status(self) -> Dict[str, dict]:
        """Return status summary for all agents."""
        return {
            agent_id: {
                "status": health.status.value,
                "tasks_completed": health.tasks_completed,
                "tasks_failed": health.tasks_failed,
                "failure_rate": f"{health.failure_rate:.1%}",
                "avg_response_ms": f"{health.avg_response_ms:.0f}",
                "error_count": health.error_count,
            }
            for agent_id, health in self._agents.items()
        }


# Singleton
_health_monitor = AgentHealthMonitor()


def get_health_monitor() -> AgentHealthMonitor:
    return _health_monitor
