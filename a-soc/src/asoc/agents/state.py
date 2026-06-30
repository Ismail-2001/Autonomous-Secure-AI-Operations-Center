import operator
from typing import Annotated, Any, Dict, List, Optional, Sequence, TypedDict

from src.asoc.agents.message import ASOCMessage
from src.asoc.agents.observation import AgentObservation


class AgentState(TypedDict):
    messages: Annotated[Sequence[ASOCMessage], operator.add]
    incident_id: str
    risk_score: float
    confidence_score: float
    agent_observations: List[AgentObservation]
    next_step: str
    is_authorized: bool
    working_memory: Dict[str, Any]


def create_initial_state() -> AgentState:
    return AgentState(
        messages=[],
        incident_id="",
        risk_score=0.0,
        confidence_score=1.0,
        agent_observations=[],
        next_step="",
        is_authorized=False,
        working_memory={},
    )
