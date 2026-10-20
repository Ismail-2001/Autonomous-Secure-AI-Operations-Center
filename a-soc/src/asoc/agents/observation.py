import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ObservationNextState(str, Enum):
    CONTINUE = "continue"
    ESCALATE = "escalate"
    HALT = "halt"


class AgentObservation(BaseModel):
    agent_id: str
    action_taken: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    tools_used: List[str] = Field(default_factory=list)
    next_state: ObservationNextState
    risk_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    observation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    error: Optional[str] = None
    retry_count: int = 0
