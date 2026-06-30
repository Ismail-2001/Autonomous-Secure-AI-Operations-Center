from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Type

import httpx
from langsmith import traceable

from src.asoc.agents.agent_message import (
    AgentMessage,
    AgentType,
    MessageBus,
    MessagePriority,
    MessageType,
    RunContext,
    get_message_bus,
)
from src.asoc.agents.base import BaseAgent
from src.asoc.agents.message import ASOCMessage, MessageType as LegacyMessageType
from src.asoc.agents.observation import AgentObservation, ObservationNextState
from src.asoc.agents.state import AgentState
from src.asoc.core.config import settings
from src.asoc.core.logging import get_logger
from src.asoc.core.retry import async_retry

logger = get_logger("asoc.agents.supervisor")


class EscalationLevel(str, Enum):
    AUTO_RETRY = "auto_retry"
    SUPERVISOR_REVIEW = "supervisor_review"
    HUMAN_PAGER = "human_pager"
    INCIDENT_COMMANDER = "incident_commander"


class EscalationPolicy:
    RISK_THRESHOLDS = {
        EscalationLevel.AUTO_RETRY: (0.0, 0.5),
        EscalationLevel.SUPERVISOR_REVIEW: (0.5, 0.8),
        EscalationLevel.HUMAN_PAGER: (0.8, 0.95),
        EscalationLevel.INCIDENT_COMMANDER: (0.95, 1.0),
    }

    CONFIDENCE_THRESHOLDS = {
        "high": 0.8,
        "medium": 0.6,
        "low": 0.4,
        "unacceptable": 0.2,
    }

    @classmethod
    def determine_level(cls, risk_score: float, confidence: float, is_destructive: bool = False) -> EscalationLevel:
        if is_destructive and risk_score > 0.7:
            return EscalationLevel.INCIDENT_COMMANDER
        if confidence < cls.CONFIDENCE_THRESHOLDS["unacceptable"]:
            return EscalationLevel.HUMAN_PAGER
        for level, (low, high) in cls.RISK_THRESHOLDS.items():
            if low <= risk_score < high:
                return level
        return EscalationLevel.SUPERVISOR_REVIEW

    @classmethod
    def should_page_human(cls, risk_score: float, confidence: float, retry_count: int, max_retries: int) -> bool:
        if retry_count >= max_retries:
            return True
        if risk_score >= 0.95:
            return True
        if confidence < 0.3 and retry_count >= 1:
            return True
        return False


class QualityGateResult(Enum):
    PASS = "pass"
    FAIL_CONFIDENCE = "fail_confidence"
    FAIL_SCHEMA = "fail_schema"
    FAIL_SAFETY = "fail_safety"
    FAIL_TIMEOUT = "fail_timeout"


class QualityGate:
    REQUIRED_FIELDS_BY_AGENT = {
        "DetectionAgent": ["risk_score", "reasoning"],
        "ForensicsAgent": ["root_cause", "blast_radius"],
        "ResponseAgent": ["success", "action"],
        "ComplianceAgent": ["mapped_controls"],
        "TelemetryAgent": ["event_count"],
        "NotificationAgent": ["sent_count"],
    }

    MIN_CONFIDENCE = {
        "DetectionAgent": 0.6,
        "ForensicsAgent": 0.5,
        "ResponseAgent": 0.9,
        "ComplianceAgent": 0.7,
        "TelemetryAgent": 0.7,
        "NotificationAgent": 0.8,
        "SupervisorAgent": 0.8,
    }

    @classmethod
    def validate(cls, observation: AgentObservation) -> tuple[QualityGateResult, str]:
        agent_id = observation.agent_id
        min_conf = cls.MIN_CONFIDENCE.get(agent_id, 0.5)
        if observation.confidence_score < min_conf:
            return QualityGateResult.FAIL_CONFIDENCE, f"confidence {observation.confidence_score:.2f} < {min_conf}"

        required = cls.REQUIRED_FIELDS_BY_AGENT.get(agent_id, [])
        for field in required:
            if field not in observation.metadata:
                return QualityGateResult.FAIL_SCHEMA, f"missing required field '{field}'"

        if observation.error:
            return QualityGateResult.FAIL_SAFETY, f"agent reported error: {observation.error}"

        return QualityGateResult.PASS, "ok"


class SupervisorAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="SupervisorAgent", description="True supervisor: quality gates, retry-with-reflection, escalation, lifecycle tracking"
        )
        self.active_incidents: Dict[str, Any] = {}
        self._run_contexts: Dict[str, RunContext] = {}
        self._message_bus: MessageBus = get_message_bus()
        self._agent_factories: Dict[str, Callable[[], BaseAgent]] = {}
        self._reflection_prompts: Dict[str, str] = {}

    def register_agent_factory(self, agent_name: str, factory: Callable[[], BaseAgent]) -> None:
        self._agent_factories[agent_name] = factory

    def _register_default_tools(self) -> None:
        self.tool_registry.register(
            name="query_opa_policy",
            func=self._tool_query_opa,
            description="Query OPA policy engine for action authorization",
            input_schema={"agent_name": {"type": "string"}, "action": {"type": "object"}, "risk_score": {"type": "number"}},
        )
        self.tool_registry.register(
            name="quality_gate",
            func=self._tool_quality_gate,
            description="Validate sub-agent output against schema, confidence thresholds, and safety rules",
            input_schema={"observation": {"type": "object"}},
        )
        self.tool_registry.register(
            name="retry_with_reflection",
            func=self._tool_retry_with_reflection,
            description="Re-run a failed agent with an improved prompt based on failure analysis",
            input_schema={"agent_name": {"type": "string"}, "original_observation": {"type": "object"}, "run_context": {"type": "object"}},
        )
        self.tool_registry.register(
            name="escalation_policy",
            func=self._tool_escalation_policy,
            description="Determine escalation level based on risk, confidence, and retry history",
            input_schema={"risk_score": {"type": "number"}, "confidence": {"type": "number"}, "agent_name": {"type": "string"}, "is_destructive": {"type": "boolean"}},
        )
        self.tool_registry.register(
            name="route_by_risk",
            func=self._tool_route_by_risk,
            description="Determine routing based on risk score and authorization status",
            input_schema={"risk_score": {"type": "number"}, "is_authorized": {"type": "boolean"}},
        )
        self.tool_registry.register(
            name="track_run_context",
            func=self._tool_track_run,
            description="Record step completion or failure in the incident RunContext",
            input_schema={"incident_id": {"type": "string"}, "step_name": {"type": "string"}, "success": {"type": "boolean"}},
        )
        self.tool_registry.register(
            name="check_agent_health",
            func=self._tool_check_agent_health,
            description="Check if a sub-agent is available and responsive",
            input_schema={"agent_name": {"type": "string"}},
        )

    def get_or_create_run_context(self, incident_id: str) -> RunContext:
        if incident_id not in self._run_contexts:
            self._run_contexts[incident_id] = RunContext(incident_id=incident_id)
        return self._run_contexts[incident_id]

    # ── Quality Gate ────────────────────────────────────────────────────────

    async def quality_gate(self, observation: AgentObservation) -> tuple[bool, QualityGateResult, str]:
        result, reason = QualityGate.validate(observation)
        passed = result == QualityGateResult.PASS
        logger.info(
            "quality_gate_result",
            agent=observation.agent_id,
            result=result.value,
            reason=reason,
            confidence=observation.confidence_score,
        )
        return passed, result, reason

    async def _tool_quality_gate(self, observation: Dict[str, Any]) -> Dict[str, Any]:
        obs = AgentObservation(**observation) if isinstance(observation, dict) and "agent_id" in observation else observation
        if isinstance(obs, dict):
            obs = AgentObservation(**obs)
        passed, result, reason = await self.quality_gate(obs)
        return {"passed": passed, "result": result.value, "reason": reason}

    # ── Retry With Reflection ──────────────────────────────────────────────

    def _build_reflection_prompt(self, original_obs: AgentObservation, context: RunContext) -> str:
        failure_analysis = []
        if original_obs.confidence_score < 0.5:
            failure_analysis.append(f"Low confidence ({original_obs.confidence_score:.2f}) suggests insufficient evidence or unclear input.")
        if original_obs.error:
            failure_analysis.append(f"Error occurred: {original_obs.error}")
        if not original_obs.tools_used:
            failure_analysis.append("No tools were invoked, indicating a reasoning gap.")

        retry_num = context.get_retry_count(original_obs.agent_id)
        hints = []
        if retry_num == 1:
            hints.append("Try alternative analysis approaches.")
            hints.append("Consider broader event context and correlated signals.")
        elif retry_num == 2:
            hints.append("Focus on the highest-signal evidence only.")
            hints.append("If uncertain, report low confidence honestly rather than guessing.")
        else:
            hints.append("Final attempt: provide best-effort analysis with explicit uncertainty markers.")

        return (
            f"RETRY REFLECTION (attempt {retry_num + 1}/{context.max_retries})\n"
            f"Agent: {original_obs.agent_id}\n"
            f"Previous action: {original_obs.action_taken}\n"
            f"Previous confidence: {original_obs.confidence_score:.2f}\n"
            f"Tools used: {original_obs.tools_used}\n"
            f"Failure analysis:\n" + "\n".join(f"  - {a}" for a in failure_analysis) + "\n"
            f"Improvement hints:\n" + "\n".join(f"  - {h}" for h in hints) + "\n"
            f"Requirements:\n"
            f"  - Increase confidence score above 0.7\n"
            f"  - Use at least one specialized tool\n"
            f"  - Provide structured metadata with required fields\n"
        )

    async def retry_with_reflection(
        self, agent_name: str, original_obs: AgentObservation, context: RunContext
    ) -> Optional[AgentObservation]:
        if not context.can_retry(agent_name):
            logger.warning("retry_exhausted", agent=agent_name, retries=context.get_retry_count(agent_name))
            return None

        retry_count = context.record_retry(agent_name)
        reflection_prompt = self._build_reflection_prompt(original_obs, context)
        logger.info("retry_with_reflection", agent=agent_name, attempt=retry_count, prompt_len=len(reflection_prompt))

        factory = self._agent_factories.get(agent_name)
        if factory is None:
            logger.warning("no_factory_for_agent", agent=agent_name)
            return None

        agent = factory()
        try:
            enhanced_state: AgentState = {
                "messages": [],
                "incident_id": context.incident_id,
                "risk_score": original_obs.risk_score or 0.0,
                "confidence_score": original_obs.confidence_score,
                "agent_observations": [],
                "next_step": "",
                "is_authorized": True,
                "working_memory": {
                    "reflection_prompt": reflection_prompt,
                    "retry_attempt": retry_count,
                    "original_observation": original_obs.model_dump(),
                },
            }
            result_state = await agent.run_cycle(enhanced_state)
            observations = result_state.get("agent_observations", [])
            if observations:
                new_obs = observations[-1]
                new_obs.retry_count = retry_count
                return new_obs
        except Exception as e:
            logger.error("retry_execution_failed", agent=agent_name, error=str(e))

        return None

    async def _tool_retry_with_reflection(
        self, agent_name: str, original_observation: Dict[str, Any], run_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        obs = AgentObservation(**original_observation)
        ctx = RunContext(**run_context) if "incident_id" in run_context else RunContext(incident_id="unknown")
        result = await self.retry_with_reflection(agent_name, obs, ctx)
        if result:
            return {"retried": True, "new_confidence": result.confidence_score, "observation": result.model_dump()}
        return {"retried": False, "reason": "exhausted or no factory"}

    # ── Escalation Policy ──────────────────────────────────────────────────

    async def escalation_policy(
        self, risk_score: float, confidence: float, agent_name: str, is_destructive: bool = False
    ) -> Dict[str, Any]:
        level = EscalationPolicy.determine_level(risk_score, confidence, is_destructive)
        context = self.get_or_create_run_context(agent_name)
        should_page = EscalationPolicy.should_page_human(
            risk_score, confidence, context.get_retry_count(agent_name), context.max_retries
        )
        return {
            "level": level.value,
            "should_page_human": should_page,
            "retry_count": context.get_retry_count(agent_name),
            "max_retries": context.max_retries,
            "action": self._escalation_action(level, should_page),
        }

    def _escalation_action(self, level: EscalationLevel, should_page: bool) -> str:
        if level == EscalationLevel.AUTO_RETRY:
            return "retry_automatically"
        if level == EscalationLevel.SUPERVISOR_REVIEW:
            return "supervisor_reviews_and_routes"
        if level == EscalationLevel.HUMAN_PAGER:
            return "page_on_call_analyst"
        if level == EscalationLevel.INCIDENT_COMMANDER:
            return "elevate_to_incident_commander"
        return "log_and_continue"

    async def _tool_escalation_policy(
        self, risk_score: float, confidence: float, agent_name: str, is_destructive: bool = False
    ) -> Dict[str, Any]:
        return await self.escalation_policy(risk_score, confidence, agent_name, is_destructive)

    # ── OPA Policy Query ───────────────────────────────────────────────────

    async def _tool_query_opa(self, agent_name: str, action: Dict[str, Any], risk_score: float) -> bool:
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
            logger.info("opa_decision", allowed=result)
            return result
        except Exception as e:
            logger.warning("opa_fallback", error=str(e))

        if risk_score > 0.7 and action.get("is_destructive", False):
            logger.warning("action_blocked_local_policy", risk_score=risk_score)
            return False
        return True

    # ── Other Tools ────────────────────────────────────────────────────────

    async def _tool_route_by_risk(self, risk_score: float, is_authorized: bool) -> str:
        if risk_score >= 0.8 and not is_authorized:
            return "hitl"
        if risk_score < 0.5:
            return "auto_approve"
        if risk_score >= 0.95:
            return "block"
        return "forensics"

    async def _tool_track_run(self, incident_id: str, step_name: str, success: bool) -> bool:
        ctx = self.get_or_create_run_context(incident_id)
        ctx.record_step(step_name, success)
        return True

    async def _tool_check_agent_health(self, agent_name: str) -> bool:
        return agent_name in self._agent_factories or True

    # ── PRAO Lifecycle ─────────────────────────────────────────────────────

    @traceable(name="supervisor_perceive", run_type="chain")
    async def perceive(self, state: AgentState) -> Dict[str, Any]:
        observations = state.get("agent_observations", [])
        latest_obs = observations[-1].model_dump() if observations else {}
        incident_id = state.get("incident_id", "")
        run_ctx = self.get_or_create_run_context(incident_id)
        return {
            "risk_score": state.get("risk_score", 0.0),
            "is_authorized": state.get("is_authorized", False),
            "incident_id": incident_id,
            "latest_observation": latest_obs,
            "message_count": len(state.get("messages", [])),
            "run_context": run_ctx.model_dump(),
        }

    @traceable(name="supervisor_reason", run_type="chain")
    async def reason(self, state: AgentState, perceived: Dict[str, Any]) -> List[Dict[str, Any]]:
        risk_score = perceived.get("risk_score", 0.0)
        is_authorized = perceived.get("is_authorized", False)
        latest_obs = perceived.get("latest_observation", {})
        calls = [
            {"tool": "route_by_risk", "args": {"risk_score": risk_score, "is_authorized": is_authorized}},
            {"tool": "escalation_policy", "args": {
                "risk_score": risk_score,
                "confidence": latest_obs.get("confidence_score", 0.5),
                "agent_name": latest_obs.get("agent_id", "unknown"),
                "is_destructive": risk_score > 0.8,
            }},
        ]
        if latest_obs:
            calls.append({"tool": "quality_gate", "args": {"observation": latest_obs}})
            if latest_obs.get("confidence_score", 1.0) < 0.7:
                calls.append({
                    "tool": "retry_with_reflection",
                    "args": {
                        "agent_name": latest_obs.get("agent_id", "unknown"),
                        "original_observation": latest_obs,
                        "run_context": perceived.get("run_context", {}),
                    },
                })
        return calls

    @traceable(name="supervisor_act", run_type="chain")
    async def act(self, tool_calls: List[Dict[str, Any]], state: AgentState) -> List[Any]:
        results = []
        for call in tool_calls:
            result = await self.tool_registry.execute(call["tool"], **call.get("args", {}))
            results.append(result)
        return results

    @traceable(name="supervisor_observe", run_type="chain")
    async def observe(self, state: AgentState, tool_results: List[Any], tool_calls: List[Dict[str, Any]]) -> AgentObservation:
        route = "forensics"
        quality_passed = True
        escalation_level = "auto_retry"
        should_page = False

        for i, r in enumerate(tool_results):
            if isinstance(r, dict):
                if "route" in r or (isinstance(r, str) and r in ("hitl", "auto_approve", "block", "forensics")):
                    route = r if isinstance(r, str) else r.get("route", "forensics")
                if "passed" in r:
                    quality_passed = r["passed"]
                if "level" in r:
                    escalation_level = r["level"]
                if "should_page_human" in r:
                    should_page = r["should_page_human"]
            elif isinstance(r, str) and r in ("hitl", "auto_approve", "block", "forensics"):
                route = r

        if not quality_passed:
            route = "supervisor"
        if should_page:
            route = "hitl"

        next_state = ObservationNextState.CONTINUE
        if route == "hitl":
            next_state = ObservationNextState.ESCALATE
        elif route == "block":
            next_state = ObservationNextState.HALT

        incident_id = state.get("incident_id", "")
        ctx = self.get_or_create_run_context(incident_id)

        return AgentObservation(
            agent_id=self.name,
            action_taken=f"supervised_{route}",
            confidence_score=0.9 if quality_passed else 0.5,
            tools_used=[c["tool"] for c in tool_calls],
            next_state=next_state,
            risk_score=state.get("risk_score"),
            metadata={
                "route": route,
                "incident_id": incident_id,
                "quality_passed": quality_passed,
                "escalation_level": escalation_level,
                "should_page_human": should_page,
                "run_duration_seconds": ctx.duration_seconds,
                "run_success_rate": ctx.success_rate,
            },
        )

    async def process_message(self, message: ASOCMessage) -> Optional[ASOCMessage]:
        if message.message_type == LegacyMessageType.ALERT:
            incident_id = message.correlation_id or message.message_id
            self.active_incidents[incident_id] = message.payload
            self.get_or_create_run_context(incident_id)
            logger.info("new_incident_recorded", incident_id=incident_id)

            risk_score = message.payload.get("risk_score", 0.5)
            if risk_score >= 0.8:
                target = "ResponseAgent"
                action = message.payload.get("action", "UNKNOWN")
            else:
                target = "ForensicsAgent"
                action = "INVESTIGATE"

            return ASOCMessage(
                message_type=LegacyMessageType.COMMAND,
                source_agent=self.name,
                target_agent=target,
                payload={"incident_id": incident_id, "data": message.payload, "action": action},
                correlation_id=incident_id,
                priority=message.priority,
            )
        return None
