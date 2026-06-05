import json
from typing import Optional

from agents.base.agent import BaseAgent
from agents.base.message import ASOCMessage, MessageType, Priority
from core.config.settings import settings


class DetectionAgent(BaseAgent):
    def __init__(self):
        super().__init__(name="DetectionAgent", description="Anomaly detection + LLM reasoning over security logs")
        self.provider = settings.LLM_PROVIDER
        self._llm = None

    def _get_llm(self):
        if self._llm is not None:
            return self._llm
        if self.provider == "openai" and settings.OPENAI_API_KEY:
            from langchain_openai import ChatOpenAI

            self._llm = ChatOpenAI(model="gpt-4", temperature=0, api_key=settings.OPENAI_API_KEY.get_secret_value())
        elif self.provider == "anthropic" and settings.ANTHROPIC_API_KEY:
            from langchain_anthropic import ChatAnthropic

            self._llm = ChatAnthropic(
                model="claude-3-opus-20240229", temperature=0, api_key=settings.ANTHROPIC_API_KEY.get_secret_value()
            )
        return self._llm

    async def analyze_threat(self, event_data: dict) -> ASOCMessage:
        """Analyze event data using LLM reasoning with fallback to mock."""
        llm = self._get_llm()

        if llm:
            try:
                from langchain.schema import HumanMessage

                prompt = f"""Analyze this AWS CloudTrail event for security threats.
Event: {json.dumps(event_data, indent=2)}

Return a JSON object with exactly these fields:
- threat_detected: boolean
- risk_score: float between 0.0 and 1.0
- reasoning: string explaining the analysis
- attack_technique: string (MITRE ATT&CK ID if applicable, or null)"""

                response = await llm.agenerate([[HumanMessage(content=prompt)]])
                result = json.loads(response.generations[0][0].text.strip())

                return ASOCMessage(
                    message_type=MessageType.ALERT,
                    source_agent=self.name,
                    payload={
                        "risk_score": result.get("risk_score", 0.5),
                        "reasoning": result.get("reasoning", "No reasoning provided"),
                        "attack_technique": result.get("attack_technique"),
                        "original_event": event_data,
                    },
                    priority=Priority.HIGH if result.get("risk_score", 0) > 0.7 else Priority.MEDIUM,
                )
            except Exception as e:
                self.logger.error(f"LLM analysis failed: {e}. Falling back to mock.")

        self.logger.info(f"Using mock analysis (no LLM configured for {self.provider})")
        threat_detected = True
        risk_score = 0.85
        reasoning = "Suspicious ConsoleLogin from unusual IP address (1.2.3.4)"

        if threat_detected:
            return ASOCMessage(
                message_type=MessageType.ALERT,
                source_agent=self.name,
                payload={
                    "risk_score": risk_score,
                    "reasoning": reasoning,
                    "original_event": event_data,
                },
                priority=Priority.HIGH,
            )
        return None

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
