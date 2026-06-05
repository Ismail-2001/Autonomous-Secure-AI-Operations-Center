from typing import Optional

from agents.base.agent import BaseAgent
from agents.base.message import ASOCMessage, MessageType


class ResponseAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="ResponseAgent", description="Executes remediation actions (IAM lock, pod isolation)")

    async def execute_remediation(self, action_type: str, target: str) -> bool:
        self.logger.info("executing_remediation", action_type=action_type, target=target)
        await self.log_event("remediation_executed", {"action": action_type, "target": target})
        return True

    async def process_message(self, message: ASOCMessage) -> Optional[ASOCMessage]:
        if message.message_type == MessageType.COMMAND and message.target_agent == self.name:
            action = message.payload.get("action")
            target = message.payload.get("target")
            success = await self.execute_remediation(action, target)
            return ASOCMessage(
                message_type=MessageType.RESPONSE, source_agent=self.name, target_agent="SupervisorAgent",
                payload={"success": success, "action": action}, correlation_id=message.correlation_id,
            )
        return None
