"""Service registry for dynamic agent discovery.

Allows agents to register themselves and discover other agents.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Coroutine, Dict, List, Optional


@dataclass
class ServiceInfo:
    """Information about a registered service/agent."""

    service_id: str
    service_type: str
    host: str = "localhost"
    port: int = 0
    status: str = "active"
    metadata: Dict[str, str] = field(default_factory=dict)
    registered_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    health_check: Optional[Callable[[], Coroutine]] = None


class ServiceRegistry:
    """In-memory service registry for agent discovery."""

    def __init__(self) -> None:
        self._services: Dict[str, ServiceInfo] = {}

    def register(
        self,
        service_id: str,
        service_type: str,
        host: str = "localhost",
        port: int = 0,
        **metadata: str,
    ) -> ServiceInfo:
        """Register a new service."""
        info = ServiceInfo(
            service_id=service_id,
            service_type=service_type,
            host=host,
            port=port,
            metadata=metadata,
        )
        self._services[service_id] = info
        return info

    def deregister(self, service_id: str) -> None:
        """Remove a service from the registry."""
        self._services.pop(service_id, None)

    def get(self, service_id: str) -> Optional[ServiceInfo]:
        return self._services.get(service_id)

    def find_by_type(self, service_type: str) -> List[ServiceInfo]:
        """Find all services of a given type."""
        return [
            s for s in self._services.values()
            if s.service_type == service_type and s.status == "active"
        ]

    def find_healthy(self) -> List[ServiceInfo]:
        """Find all active services."""
        return [s for s in self._services.values() if s.status == "active"]

    def list_all(self) -> List[ServiceInfo]:
        return list(self._services.values())

    @property
    def count(self) -> int:
        return len(self._services)


# Singleton
_registry = ServiceRegistry()


def get_service_registry() -> ServiceRegistry:
    return _registry
