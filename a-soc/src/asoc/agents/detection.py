from typing import Any, Dict, List, Optional

from langsmith import traceable

from src.asoc.agents.base import BaseAgent, HIGH_RISK_TOOLS
from src.asoc.agents.message import ASOCMessage, MessageType, Priority
from src.asoc.agents.observation import AgentObservation, ObservationNextState
from src.asoc.agents.state import AgentState
from src.asoc.llm.providers import LLMProvider, LLMResult, MockProvider, create_llm_provider
from src.asoc.mitre.mapper import MitreTechnique, mitre_mapper
from src.asoc.middleware.prompt_injection import validate_agent_input


class DetectionAgent(BaseAgent):
    def __init__(self, provider: Optional[LLMProvider] = None):
        super().__init__(
            name="DetectionAgent", description="Anomaly detection + LLM reasoning + MITRE ATT&CK over security logs"
        )
        self._provider = provider or create_llm_provider()

    def _register_default_tools(self) -> None:
        self.tool_registry.register(
            name="analyze_threat_llm",
            func=self._tool_analyze_threat,
            description="Use LLM to analyze event for security threats and risk scoring",
            input_schema={"event_data": {"type": "object"}},
            output_schema={"threat_detected": {"type": "boolean"}, "risk_score": {"type": "number"}},
        )
        self.tool_registry.register(
            name="map_mitre_technique",
            func=self._tool_map_mitre,
            description="Map event to MITRE ATT&CK technique",
            input_schema={"event_data": {"type": "object"}, "llm_technique": {"type": "string"}},
            output_schema={"technique_id": {"type": "string"}},
        )
        self.tool_registry.register(
            name="query_risk_rules",
            func=self._tool_query_risk_rules,
            description="Query OPA policy engine for current risk thresholds",
            input_schema={"event_type": {"type": "string"}},
            output_schema={"thresholds": {"type": "object"}},
        )
        self.tool_registry.register(
            name="calculate_risk_score",
            func=self._tool_calculate_risk,
            description="Combine LLM analysis with rule-based scoring to produce final risk score",
            input_schema={"llm_result": {"type": "object"}, "mitre": {"type": "object"}, "event_data": {"type": "object"}},
            output_schema={"final_risk_score": {"type": "number"}, "confidence": {"type": "number"}},
        )

    def _enrich_mitre(self, event_data: dict, llm_technique: Optional[str] = None) -> Optional[MitreTechnique]:
        mapped = mitre_mapper.map_event(event_data)
        if mapped:
            return mapped
        if llm_technique:
            return mitre_mapper.map_by_event_name(llm_technique)
        return None

    async def _tool_analyze_threat(self, event_data: dict) -> Dict[str, Any]:
        try:
            result = await self._provider.analyze(event_data)
            return {
                "threat_detected": result.threat_detected,
                "risk_score": result.risk_score,
                "reasoning": result.reasoning,
                "attack_technique": result.attack_technique,
            }
        except Exception as e:
            self.logger.error("llm_analysis_failed", error=str(e))
            fallback = MockProvider()
            result = await fallback.analyze(event_data)
            return {
                "threat_detected": result.threat_detected,
                "risk_score": result.risk_score,
                "reasoning": result.reasoning,
                "attack_technique": result.attack_technique,
            }

    async def _tool_map_mitre(self, event_data: dict, llm_technique: Optional[str] = None) -> Optional[Dict[str, Any]]:
        mitre = self._enrich_mitre(event_data, llm_technique)
        if mitre:
            return {"technique_id": mitre.id, "technique_name": mitre.name, "tactic": mitre.tactic, "description": mitre.description}
        return None

    async def _tool_query_risk_rules(self, event_type: str) -> Dict[str, Any]:
        return {
            "auto_approve_threshold": 0.5,
            "escalation_threshold": 0.7,
            "hitl_threshold": 0.8,
            "block_threshold": 0.95,
            "event_type": event_type,
        }

    async def _tool_calculate_risk(self, llm_result: dict, mitre: Optional[dict], event_data: dict) -> Dict[str, Any]:
        base_score = llm_result.get("risk_score", 0.5)
        mitre_boost = 0.1 if mitre else 0.0
        event_name = event_data.get("eventName", event_data.get("event_name", ""))
        high_risk_events = {"ConsoleLogin", "CreateUser", "DeleteBucket", "TerminateInstance", "AuthorizeSecurityGroupIngress"}
        event_boost = 0.15 if event_name in high_risk_events else 0.0
        final_score = min(1.0, base_score + mitre_boost + event_boost)
        confidence = 0.8 if mitre else 0.6
        if base_score > 0.9:
            confidence = 0.95
        return {"final_risk_score": round(final_score, 3), "confidence": round(confidence, 3)}

    async def analyze_threat(self, event_data: dict) -> ASOCMessage:
        validate_agent_input("DetectionAgent", event_data=str(event_data))

        tool_calls = [
            {"tool": "analyze_threat_llm", "args": {"event_data": event_data}},
        ]
        llm_result = await self.tool_registry.execute("analyze_threat_llm", event_data=event_data)
        mitre = await self.tool_registry.execute("map_mitre_technique", event_data=event_data, llm_technique=llm_result.get("attack_technique"))
        risk = await self.tool_registry.execute("calculate_risk_score", llm_result=llm_result, mitre=mitre, event_data=event_data)

        return ASOCMessage(
            message_type=MessageType.ALERT,
            source_agent=self.name,
            payload={
                "risk_score": risk["final_risk_score"],
                "reasoning": llm_result["reasoning"],
                "attack_technique": llm_result.get("attack_technique") or (mitre["technique_id"] if mitre else None),
                "mitre": mitre or {},
                "original_event": event_data,
            },
            priority=Priority.HIGH if risk["final_risk_score"] > 0.7 else Priority.MEDIUM,
        )

    @traceable(name="detection_perceive", run_type="chain")
    async def perceive(self, state: AgentState) -> Dict[str, Any]:
        latest_msg = state["messages"][-1] if state.get("messages") else None
        event_data = {}
        if latest_msg:
            event_data = latest_msg.payload.get("event", latest_msg.payload)
        return {"event_data": event_data, "message_count": len(state.get("messages", []))}

    @traceable(name="detection_reason", run_type="chain")
    async def reason(self, state: AgentState, perceived: Dict[str, Any]) -> List[Dict[str, Any]]:
        event_data = perceived.get("event_data", {})
        calls = [
            {"tool": "analyze_threat_llm", "args": {"event_data": event_data}},
            {"tool": "map_mitre_technique", "args": {"event_data": event_data}},
        ]
        event_name = event_data.get("eventName", event_data.get("event_name", ""))
        if event_name:
            calls.append({"tool": "query_risk_rules", "args": {"event_type": event_name}})
        calls.append({
            "tool": "calculate_risk_score",
            "args": {"llm_result": {}, "mitre": None, "event_data": event_data},
        })
        return calls

    @traceable(name="detection_act", run_type="chain")
    async def act(self, tool_calls: List[Dict[str, Any]], state: AgentState) -> List[Any]:
        results = []
        llm_result = None
        mitre = None
        for call in tool_calls:
            tool_name = call["tool"]
            args = call.get("args", {})
            if tool_name == "calculate_risk_score":
                args["llm_result"] = llm_result or {}
                args["mitre"] = mitre
            result = await self.tool_registry.execute(tool_name, **args)
            if tool_name == "analyze_threat_llm":
                llm_result = result
            elif tool_name == "map_mitre_technique":
                mitre = result
            results.append(result)
        return results

    @traceable(name="detection_observe", run_type="chain")
    async def observe(self, state: AgentState, tool_results: List[Any], tool_calls: List[Dict[str, Any]]) -> AgentObservation:
        llm_result = tool_results[0] if tool_results else {}
        risk_score = 0.5
        confidence = 0.5
        for r in tool_results:
            if isinstance(r, dict) and "final_risk_score" in r:
                risk_score = r["final_risk_score"]
                confidence = r.get("confidence", 0.5)

        if confidence < 0.7:
            next_state = ObservationNextState.ESCALATE
        elif risk_score >= 0.8:
            next_state = ObservationNextState.ESCALATE
        else:
            next_state = ObservationNextState.CONTINUE

        return AgentObservation(
            agent_id=self.name,
            action_taken="threat_analyzed",
            confidence_score=confidence,
            tools_used=[c["tool"] for c in tool_calls],
            next_state=next_state,
            risk_score=risk_score,
            metadata={"llm_reasoning": llm_result.get("reasoning", "") if isinstance(llm_result, dict) else ""},
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
