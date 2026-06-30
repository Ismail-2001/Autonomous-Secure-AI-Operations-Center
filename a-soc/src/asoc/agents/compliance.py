from typing import Any, Dict, List, Optional

from langsmith import traceable

from src.asoc.agents.base import BaseAgent
from src.asoc.agents.message import ASOCMessage, MessageType
from src.asoc.agents.observation import AgentObservation, ObservationNextState
from src.asoc.agents.state import AgentState


class ComplianceAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="ComplianceAgent", description="Checks security events against SOC2, ISO 27001, and HIPAA frameworks"
        )
        self.framework_mappings = {
            "revoked_access": ["SOC2.CC6.1", "ISO.A.9.2.6", "NIST.AC-6"],
            "unauthorized_login": ["SOC2.CC6.8", "NIST.AC-2", "HIPAA.164.312.d"],
            "data_exfiltration": ["GDPR.Art.33", "HIPAA.164.308", "SOC2.CC6.7"],
            "privilege_escalation": ["SOC2.CC6.1", "NIST.AC-6.1", "ISO.A.9.2.3"],
            "brute_force": ["NIST.AC-7", "SOC2.CC6.1", "ISO.A.9.4.3"],
            "suspicious_console_login": ["SOC2.CC6.8", "NIST.AC-2", "HIPAA.164.312.b"],
        }

    def _register_default_tools(self) -> None:
        self.tool_registry.register(
            name="map_to_frameworks",
            func=self._tool_map_to_frameworks,
            description="Map a security event to applicable compliance framework controls",
            input_schema={"event_type": {"type": "string"}, "details": {"type": "object"}},
            output_schema={"controls": {"type": "array"}},
        )
        self.tool_registry.register(
            name="check_control_status",
            func=self._tool_check_control,
            description="Check if a specific compliance control is currently active or remediated",
            input_schema={"control_id": {"type": "string"}, "incident_id": {"type": "string"}},
            output_schema={"status": {"type": "string"}},
        )
        self.tool_registry.register(
            name="generate_compliance_report",
            func=self._tool_generate_report,
            description="Generate a compliance finding report for an incident",
            input_schema={"event_type": {"type": "string"}, "controls": {"type": "array"}, "details": {"type": "object"}},
            output_schema={"report": {"type": "object"}},
        )

    def _infer_event_type(self, payload: Dict[str, Any]) -> str:
        action = payload.get("action", payload.get("event_type", ""))
        if not action:
            event = payload.get("event", payload.get("original_event", {}))
            action = event.get("eventName", event.get("event_name", ""))
        action_lower = action.lower().replace("_", "").replace("-", "")
        if "login" in action_lower or "consolelogin" in action_lower:
            return "suspicious_console_login"
        if "delete" in action_lower and "bucket" in action_lower:
            return "data_exfiltration"
        if "terminate" in action_lower or "instance" in action_lower:
            return "privilege_escalation"
        if "createuser" in action_lower:
            return "privilege_escalation"
        if "authorize" in action_lower and "securitygroup" in action_lower:
            return "brute_force"
        if "revoke" in action_lower:
            return "revoked_access"
        return "unauthorized_login"

    async def _tool_map_to_frameworks(self, event_type: str, details: Dict[str, Any] = None) -> List[str]:
        controls = self.framework_mappings.get(event_type, ["GENERAL_SECURITY_ALERT"])
        self.logger.info("compliance_mapped", event_type=event_type, controls=controls)
        return controls

    async def _tool_check_control(self, control_id: str, incident_id: str = "") -> str:
        self.logger.info("control_status_check", control_id=control_id, incident_id=incident_id)
        return "requires_remediation"

    async def _tool_generate_report(self, event_type: str, controls: List[str], details: Dict[str, Any] = None) -> Dict[str, Any]:
        return {
            "event_type": event_type,
            "mapped_controls": controls,
            "severity": "high" if len(controls) > 2 else "medium",
            "remediation_required": True,
            "details": details or {},
            "finding_status": "open",
        }

    async def map_incident(self, event_type: str, details: Dict[str, Any] = None) -> List[str]:
        return await self._tool_map_to_frameworks(event_type, details)

    @traceable(name="compliance_perceive", run_type="chain")
    async def perceive(self, state: AgentState) -> Dict[str, Any]:
        latest_msg = state["messages"][-1] if state.get("messages") else None
        payload = latest_msg.payload if latest_msg else {}
        observations = state.get("agent_observations", [])
        return {
            "payload": payload,
            "event_type": self._infer_event_type(payload),
            "has_observations": len(observations) > 0,
        }

    @traceable(name="compliance_reason", run_type="chain")
    async def reason(self, state: AgentState, perceived: Dict[str, Any]) -> List[Dict[str, Any]]:
        event_type = perceived.get("event_type", "unauthorized_login")
        payload = perceived.get("payload", {})
        return [
            {"tool": "map_to_frameworks", "args": {"event_type": event_type, "details": payload}},
            {"tool": "generate_compliance_report", "args": {"event_type": event_type, "controls": [], "details": payload}},
        ]

    @traceable(name="compliance_act", run_type="chain")
    async def act(self, tool_calls: List[Dict[str, Any]], state: AgentState) -> List[Any]:
        results = []
        controls = []
        for call in tool_calls:
            tool_name = call["tool"]
            args = call.get("args", {})
            if tool_name == "generate_compliance_report":
                args["controls"] = controls
            result = await self.tool_registry.execute(tool_name, **args)
            if tool_name == "map_to_frameworks":
                controls = result
            results.append(result)
        return results

    @traceable(name="compliance_observe", run_type="chain")
    async def observe(self, state: AgentState, tool_results: List[Any], tool_calls: List[Dict[str, Any]]) -> AgentObservation:
        report = {}
        for r in tool_results:
            if isinstance(r, dict) and "event_type" in r:
                report = r

        return AgentObservation(
            agent_id=self.name,
            action_taken="compliance_report_generated",
            confidence_score=0.85,
            tools_used=[c["tool"] for c in tool_calls],
            next_state=ObservationNextState.CONTINUE,
            risk_score=state.get("risk_score"),
            metadata={"report": report},
        )

    async def process_message(self, message: ASOCMessage) -> Optional[ASOCMessage]:
        if message.message_type == MessageType.LOG:
            event_type = message.payload.get("event_type", self._infer_event_type(message.payload))
            controls = await self.map_incident(event_type, message.payload.get("details", {}))
            await self.log_event("compliance_finding", {"original_event": event_type, "mapped_controls": controls})
        return None
