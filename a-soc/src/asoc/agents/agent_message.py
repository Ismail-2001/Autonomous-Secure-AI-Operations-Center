import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AgentType(str, Enum):
    TELEMETRY = "TelemetryAgent"
    DETECTION = "DetectionAgent"
    SUPERVISOR = "SupervisorAgent"
    FORENSICS = "ForensicsAgent"
    RESPONSE = "ResponseAgent"
    COMPLIANCE = "ComplianceAgent"
    NOTIFICATION = "NotificationAgent"
    HITL = "HITLGateway"
    SYSTEM = "System"


class MessageType(str, Enum):
    ALERT = "alert"
    COMMAND = "command"
    QUERY = "query"
    RESPONSE = "response"
    REPORT = "report"
    LOG = "log"
    QUALITY_GATE = "quality_gate"
    RETRY = "retry"
    ESCALATION = "escalation"
    APPROVAL_REQUEST = "approval_request"
    APPROVAL_RESPONSE = "approval_response"


class MessagePriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class AgentMessage(BaseModel):
    message_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender: AgentType
    receiver: AgentType
    message_type: MessageType
    payload: Dict[str, Any] = Field(default_factory=dict)
    correlation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    priority: MessagePriority = MessagePriority.NORMAL
    thread_id: Optional[str] = None
    in_reply_to: Optional[str] = None
    ttl_seconds: int = 300
    metadata: Dict[str, Any] = Field(default_factory=dict)

    def create_reply(
        self,
        sender: AgentType,
        message_type: MessageType,
        payload: Dict[str, Any],
        priority: MessagePriority = MessagePriority.NORMAL,
    ) -> "AgentMessage":
        return AgentMessage(
            sender=sender,
            receiver=self.sender,
            message_type=message_type,
            payload=payload,
            correlation_id=self.correlation_id,
            thread_id=self.thread_id or self.message_id,
            in_reply_to=self.message_id,
            priority=priority,
        )


class RunContext(BaseModel):
    run_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    incident_id: str
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    current_step: str = ""
    steps_completed: List[str] = Field(default_factory=list)
    steps_failed: List[str] = Field(default_factory=list)
    retry_counts: Dict[str, int] = Field(default_factory=dict)
    max_retries: int = 3
    observations: List[Dict[str, Any]] = Field(default_factory=list)
    messages: List[Dict[str, Any]] = Field(default_factory=list)
    escalation_history: List[Dict[str, Any]] = Field(default_factory=list)
    final_status: str = "in_progress"
    metadata: Dict[str, Any] = Field(default_factory=dict)

    def record_step(self, step_name: str, success: bool, details: Optional[Dict[str, Any]] = None) -> None:
        self.updated_at = datetime.now(timezone.utc)
        if success:
            self.steps_completed.append(step_name)
        else:
            self.steps_failed.append(step_name)
        self.metadata[f"step_{step_name}"] = {
            "success": success,
            "timestamp": self.updated_at.isoformat(),
            "details": details or {},
        }

    def record_retry(self, agent_name: str) -> int:
        count = self.retry_counts.get(agent_name, 0) + 1
        self.retry_counts[agent_name] = count
        self.updated_at = datetime.now(timezone.utc)
        return count

    def get_retry_count(self, agent_name: str) -> int:
        return self.retry_counts.get(agent_name, 0)

    def can_retry(self, agent_name: str) -> bool:
        return self.get_retry_count(agent_name) < self.max_retries

    def record_escalation(self, from_agent: str, to_agent: str, reason: str) -> None:
        self.escalation_history.append({
            "from": from_agent,
            "to": to_agent,
            "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        self.updated_at = datetime.now(timezone.utc)

    def mark_complete(self, status: str = "completed") -> None:
        self.final_status = status
        self.updated_at = datetime.now(timezone.utc)

    @property
    def duration_seconds(self) -> float:
        return (self.updated_at - self.started_at).total_seconds()

    @property
    def success_rate(self) -> float:
        total = len(self.steps_completed) + len(self.steps_failed)
        return len(self.steps_completed) / total if total > 0 else 0.0


class MessageBus:
    """In-process typed message bus for inter-agent communication."""

    def __init__(self):
        self._subscribers: Dict[AgentType, List[Any]] = {}
        self._history: List[AgentMessage] = []
        self._max_history = 1000

    def subscribe(self, agent_type: AgentType, handler) -> None:
        if agent_type not in self._subscribers:
            self._subscribers[agent_type] = []
        self._subscribers[agent_type].append(handler)

    def unsubscribe(self, agent_type: AgentType, handler) -> None:
        if agent_type in self._subscribers:
            self._subscribers[agent_type] = [h for h in self._subscribers[agent_type] if h is not handler]

    async def publish(self, message: AgentMessage) -> None:
        self._history.append(message)
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]

        handlers = self._subscribers.get(message.receiver, [])
        for handler in handlers:
            try:
                await handler(message)
            except Exception:
                pass

    def get_history(
        self,
        correlation_id: Optional[str] = None,
        sender: Optional[AgentType] = None,
        receiver: Optional[AgentType] = None,
        limit: int = 50,
    ) -> List[AgentMessage]:
        results = self._history
        if correlation_id:
            results = [m for m in results if m.correlation_id == correlation_id]
        if sender:
            results = [m for m in results if m.sender == sender]
        if receiver:
            results = [m for m in results if m.receiver == receiver]
        return results[-limit:]


_bus_instance: Optional[MessageBus] = None


def get_message_bus() -> MessageBus:
    global _bus_instance
    if _bus_instance is None:
        _bus_instance = MessageBus()
    return _bus_instance
