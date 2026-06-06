from typing import Any, Dict, List, Optional

from src.asoc.agents.base import BaseAgent
from src.asoc.agents.message import ASOCMessage, MessageType


class ComplianceAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="ComplianceAgent", description="Checks security events against SOC2, ISO 27001, and HIPAA frameworks"
        )
        self.framework_mappings = {
            "revoked_access": ["SOC2.CC6.1", "ISO.A.9.2.6"],
            "unauthorized_login": ["SOC2.CC6.8", "NIST.AC-2"],
            "data_exfiltration": ["GDPR.Art.33", "HIPAA.164.308"],
        }

    async def map_incident(self, event_type: str, details: Dict[str, Any]) -> List[str]:
        findings = self.framework_mappings.get(event_type, ["GENERAL_SECURITY_ALERT"])
        self.logger.info("compliance_mapped", event_type=event_type, findings=findings)
        return findings

    async def process_message(self, message: ASOCMessage) -> Optional[ASOCMessage]:
        if message.message_type == MessageType.LOG:
            event_type = message.payload.get("event_type")
            controls = await self.map_incident(event_type, message.payload.get("details", {}))
            await self.log_event("compliance_finding", {"original_event": event_type, "mapped_controls": controls})
        return None
