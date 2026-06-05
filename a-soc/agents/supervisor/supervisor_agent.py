from typing import Any, Dict, Optional

import httpx

from agents.base.agent import BaseAgent
from agents.base.message import ASOCMessage, MessageType
from core.config.settings import settings
from core.retry import async_retry


class SupervisorAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="SupervisorAgent", description="Enforces policies, manages approval gates, and coordinates agents"
        )
        self.active_incidents: Dict[str, Any] = {}

    async def evaluate_action(self, agent_name: str, action: Dict[str, Any], risk_score: float) -> bool:
        self.logger.info("evaluating_action", agent=agent_name, action_type=action.get("type"), risk_score=risk_score)

        opa_input = {
            "input": {
                "action": {"type": action.get("type", "unknown"), "risk_score": risk_score, "agent": agent_name},
                "user": action.get("user", "system"),
                "resource": action.get("target", "unknown"),
            }
        }

        try:

            async def _query_opa():
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"{settings.OPA_URL}/v1/data/asoc/actions/allow", json=opa_input, timeout=2.0
                    )
                    if response.status_code == 200:
                        return response.json().get("result", False)
                    raise httpx.HTTPStatusError(
                        f"OPA returned {response.status_code}", request=response.request, response=response
                    )

            result = await async_retry(_query_opa, max_retries=2, exceptions=(httpx.HTTPError, httpx.TimeoutException))
            self.logger.info("opa_decision", allowed=result)
            return result

        except Exception as e:
            self.logger.warning("opa_fallback", error=str(e))

        if risk_score > 0.7 and action.get("is_destructive", False):
            self.logger.warning("action_blocked_local_policy", risk_score=risk_score)
            return False
        return True

    async def process_message(self, message: ASOCMessage) -> Optional[ASOCMessage]:
        if message.message_type == MessageType.ALERT:
            incident_id = message.correlation_id or message.message_id
            self.active_incidents[incident_id] = message.payload
            self.logger.info("new_incident_recorded", incident_id=incident_id)

            return ASOCMessage(
                message_type=MessageType.COMMAND,
                source_agent=self.name,
                target_agent="ForensicsAgent",
                payload={"incident_id": incident_id, "data": message.payload},
                correlation_id=incident_id,
                priority=message.priority,
            )
        return None
