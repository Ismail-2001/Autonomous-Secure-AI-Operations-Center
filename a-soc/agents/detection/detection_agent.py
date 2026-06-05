from typing import Optional

from agents.base.agent import BaseAgent
from agents.base.message import ASOCMessage, MessageType, Priority
from core.llm.providers import LLMProvider, MockProvider, create_llm_provider
from core.mitre.mapper import MitreTechnique, mitre_mapper


class DetectionAgent(BaseAgent):
    def __init__(self, provider: Optional[LLMProvider] = None):
        super().__init__(
            name="DetectionAgent", description="Anomaly detection + LLM reasoning + MITRE ATT&CK over security logs"
        )
        self._provider = provider or create_llm_provider()

    def _enrich_mitre(self, event_data: dict, llm_technique: Optional[str] = None) -> Optional[MitreTechnique]:
        mapped = mitre_mapper.map_event(event_data)
        if mapped:
            return mapped
        if llm_technique:
            return mitre_mapper.map_by_event_name(llm_technique)
        return None

    async def analyze_threat(self, event_data: dict) -> ASOCMessage:
        try:
            result = await self._provider.analyze(event_data)
            self.logger.info("analysis_complete", provider=self._provider.name, risk_score=result.risk_score)

            mitre = self._enrich_mitre(event_data, result.attack_technique)
            mitre_info = {}
            if mitre:
                mitre_info = {
                    "technique_id": mitre.id,
                    "technique_name": mitre.name,
                    "tactic": mitre.tactic,
                    "description": mitre.description,
                }

            return ASOCMessage(
                message_type=MessageType.ALERT,
                source_agent=self.name,
                payload={
                    "risk_score": result.risk_score,
                    "reasoning": result.reasoning,
                    "attack_technique": result.attack_technique or (mitre.id if mitre else None),
                    "mitre": mitre_info,
                    "original_event": event_data,
                },
                priority=Priority.HIGH if result.risk_score > 0.7 else Priority.MEDIUM,
            )
        except Exception as e:
            self.logger.error("analysis_failed_using_fallback", error=str(e))
            fallback = MockProvider()
            result = await fallback.analyze(event_data)
            mitre = self._enrich_mitre(event_data, result.attack_technique)
            mitre_info = {}
            if mitre:
                mitre_info = {
                    "technique_id": mitre.id,
                    "technique_name": mitre.name,
                    "tactic": mitre.tactic,
                    "description": mitre.description,
                }
            return ASOCMessage(
                message_type=MessageType.ALERT,
                source_agent=self.name,
                payload={
                    "risk_score": result.risk_score,
                    "reasoning": result.reasoning,
                    "attack_technique": result.attack_technique or (mitre.id if mitre else None),
                    "mitre": mitre_info,
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
