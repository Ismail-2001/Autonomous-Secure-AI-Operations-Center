import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, ConfigDict


class MessageType(str, Enum):
    ALERT = "alert"
    COMMAND = "command"
    QUERY = "query"
    RESPONSE = "response"
    LOG = "log"


class Priority(int, Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4


class SecurityContext(BaseModel):
    tenant_id: str
    resource_id: Optional[str] = None
    risk_score: float = 0.0


class ASOCMessage(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    message_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    message_type: MessageType
    source_agent: str
    target_agent: Optional[str] = None
    payload: Dict[str, Any]
    priority: Priority = Priority.LOW
    security_context: Optional[SecurityContext] = None
    correlation_id: Optional[str] = None
