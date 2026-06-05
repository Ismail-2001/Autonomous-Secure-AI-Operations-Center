from typing import Optional

from agents.base.agent import BaseAgent
from agents.base.message import ASOCMessage, MessageType, Priority
from core.llm.providers import LLMProvider, MockProvider, create_llm_provider


class DetectionAgent(BaseAgent):
    def __init__(self, provider: Optional[LLMProvider] = None):
        super().__init__(name="DetectionAgent", description="Anomaly detection + LLM reasoning over security logs")
        self._provider = provider or create_llm_provider()

    async def analyze_threat(self, event_data: dict) -> ASOCMessage:
        try:
            result = await self._provider.analyze(event_data)
            self.logger.info(f"Analysis complete via {self._provider.name}: risk={result.risk_score}")
            return ASOCMessage(
                message_type=MessageType.ALERT,
                source_agent=self.name,
                payload={
                    "risk_score": result.risk_score,
                    "reasoning": result.reasoning,
                    "attack_technique": result.attack_technique,
                    "original_event": event_data,
                },
                priority=Priority.HIGH if result.risk_score > 0.7 else Priority.MEDIUM,
            )
        except Exception as e:
            self.logger.error(f"LLM analysis failed: {e}. Using mock fallback.")
            fallback = MockProvider()
            result = await fallback.analyze(event_data)
            return ASOCMessage(
                message_type=MessageType.ALERT,
                source_agent=self.name,
                payload={
                    "risk_score": result.risk_score,
                    "reasoning": result.reasoning,
                    "original_event": event_data,
                },
                priority=Priority.HIGH,
            )

    async def process_message(self, message: ASOCMessage) -> Optional[ASOCMessage]:
        if message.message_type == MessageType.ALERT and message.source_agent == "TelemetryAgent":
            event = message.payload.get("event") or message.payload
            analysis_result = await self.analyze_threat(event)
            if analysis_result:
                await self.send_message(analysis_result)
                await self.log_event(
                    "threat_detected",
                    {
                        "risk_score": analysis_result.payload["risk_score"],
                        "reasoning": analysis_result.payload["reasoning"],
                    },
                )
                return analysis_result
        return None
