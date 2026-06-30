"""Structured response formatter for agent outputs.

Standardizes agent responses for consistent consumption.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class AgentResponse:
    """Standardized agent response format."""

    agent_id: str
    agent_type: str
    success: bool
    data: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    execution_time_ms: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "agent_id": self.agent_id,
            "agent_type": self.agent_type,
            "success": self.success,
            "data": self.data,
            "errors": self.errors,
            "warnings": self.warnings,
            "metadata": self.metadata,
            "execution_time_ms": self.execution_time_ms,
        }


class ResponseFormatter:
    """Factory for creating standardized agent responses."""

    @staticmethod
    def success(
        agent_id: str,
        agent_type: str,
        data: Optional[Dict[str, Any]] = None,
        **metadata: Any,
    ) -> AgentResponse:
        return AgentResponse(
            agent_id=agent_id,
            agent_type=agent_type,
            success=True,
            data=data or {},
            metadata=metadata,
        )

    @staticmethod
    def error(
        agent_id: str,
        agent_type: str,
        errors: List[str],
        **metadata: Any,
    ) -> AgentResponse:
        return AgentResponse(
            agent_id=agent_id,
            agent_type=agent_type,
            success=False,
            errors=errors,
            metadata=metadata,
        )

    @staticmethod
    def partial(
        agent_id: str,
        agent_type: str,
        data: Optional[Dict[str, Any]] = None,
        warnings: Optional[List[str]] = None,
        **metadata: Any,
    ) -> AgentResponse:
        return AgentResponse(
            agent_id=agent_id,
            agent_type=agent_type,
            success=True,
            data=data or {},
            warnings=warnings or [],
            metadata=metadata,
        )
