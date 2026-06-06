import abc
from typing import Any, Dict, Optional

from src.asoc.agents.message import ASOCMessage, MessageType
from src.asoc.core.logging import get_logger


class BaseAgent(abc.ABC):
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        self.logger = get_logger(f"asoc.agents.{name}")

    @abc.abstractmethod
    async def process_message(self, message: ASOCMessage) -> Optional[ASOCMessage]: ...

    async def send_message(self, message: ASOCMessage):
        from src.asoc.core.message_bus import get_message_bus

        self.logger.info("sending_message", message_id=message.message_id, target=message.target_agent)
        try:
            bus = await get_message_bus()
            topic = message.target_agent or "broadcast"
            await bus.publish(
                topic,
                {
                    "message_id": message.message_id,
                    "message_type": message.message_type.value,
                    "source_agent": message.source_agent,
                    "target_agent": message.target_agent,
                    "payload": message.payload,
                    "correlation_id": message.correlation_id,
                    "priority": message.priority.value if hasattr(message.priority, "value") else message.priority,
                },
            )
        except Exception as e:
            self.logger.error("send_message_failed", error=str(e), message_id=message.message_id)

    async def log_event(self, event_type: str, details: Dict[str, Any]):
        log_msg = ASOCMessage(
            message_type=MessageType.LOG,
            source_agent=self.name,
            payload={"event_type": event_type, "details": details},
        )
        self.logger.info("audit_event", event_type=event_type, details=details)

        try:
            from src.asoc.core.event_store import PostgresEventStore

            store = PostgresEventStore()
            await store.append_event(event_type, details, self.name)
        except Exception as e:
            self.logger.error("event_persist_failed", error=str(e), event_type=event_type)

        await self.send_message(log_msg)

    def __repr__(self):
        return f"Agent(name={self.name}, type={self.__class__.__name__})"
