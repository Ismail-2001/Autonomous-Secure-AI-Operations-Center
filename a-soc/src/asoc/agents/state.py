"""Agent state definitions for LangGraph workflow execution.

AgentState is the shared TypedDict that flows through the graph.
Each agent reads from and writes to this state.
"""

import operator
from typing import Annotated, Any, Dict, List, Optional, Sequence, TypedDict

from src.asoc.agents.message import ASOCMessage
from src.asoc.agents.observation import AgentObservation


class AgentState(TypedDict):
    """Shared state across all agents in the LangGraph workflow.

    Attributes:
        messages: Conversation history (append-only via operator.add)
        incident_id: Unique identifier for the current incident
        risk_score: Composite risk score (0.0-1.0) from DetectionAgent
        confidence_score: Confidence in analysis (0.0-1.0)
        agent_observations: List of agent observations for audit trail
        next_step: Routing hint for conditional edges
        is_authorized: Whether human approval has been granted
        working_memory: Agent-specific scratch space
        agent_id: Which agent is currently processing
        role: Current user role for RBAC decisions
        escalation_level: Current escalation level (auto_retry/supervisor_review/human_pager/incident_commander)
        created_at: ISO timestamp of incident creation
        updated_at: ISO timestamp of last state update
    """

    messages: Annotated[Sequence[ASOCMessage], operator.add]
    incident_id: str
    risk_score: float
    confidence_score: float
    agent_observations: List[AgentObservation]
    next_step: str
    is_authorized: bool
    working_memory: Dict[str, Any]
    agent_id: Optional[str]
    role: Optional[str]
    escalation_level: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]


def create_initial_state() -> AgentState:
    """Create a fresh initial state for a new incident investigation."""
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    return AgentState(
        messages=[],
        incident_id="",
        risk_score=0.0,
        confidence_score=1.0,
        agent_observations=[],
        next_step="",
        is_authorized=False,
        working_memory={},
        agent_id=None,
        role="analyst",
        escalation_level=None,
        created_at=now,
        updated_at=now,
    )
