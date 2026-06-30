import abc
import json
import logging
from typing import Any, Dict, List, Optional

from langsmith import traceable

from src.asoc.agents.message import ASOCMessage, MessageType
from src.asoc.agents.observation import AgentObservation, ObservationNextState
from src.asoc.agents.state import AgentState
from src.asoc.agents.tools import ToolRegistry
from src.asoc.audit.audit_trail import log_agent_action
from src.asoc.core.logging import get_logger
from src.asoc.middleware.rate_limiter import get_agent_rate_limiter

HIGH_RISK_TOOLS = {"revoke_iam_access", "isolate_instance", "quarantine_s3_bucket", "block_ip_address"}


class BaseAgent(abc.ABC):
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        self.logger = get_logger(f"asoc.agents.{name}")
        self.tool_registry = ToolRegistry()
        self._register_default_tools()

    def _register_default_tools(self) -> None:
        pass

    @traceable(name="agent_perceive", run_type="chain")
    async def perceive(self, state: AgentState) -> Dict[str, Any]:
        """Extract relevant data from state for decision-making."""
        ...

    @traceable(name="agent_reason", run_type="chain")
    async def reason(self, state: AgentState, perceived: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Suggest tool calls based on perceived data. Returns list of {tool, args} dicts."""
        ...

    @traceable(name="agent_act", run_type="chain")
    async def act(self, tool_calls: List[Dict[str, Any]], state: AgentState) -> List[Any]:
        """Execute validated tool calls and return results."""
        ...

    @traceable(name="agent_observe", run_type="chain")
    async def observe(self, state: AgentState, tool_results: List[Any], tool_calls: List[Dict[str, Any]]) -> AgentObservation:
        """Generate structured observation from action results."""
        ...

    @traceable(name="agent_run_cycle", run_type="chain")
    async def run_cycle(self, state: AgentState) -> AgentState:
        """Execute the full perceive-reason-act-observe cycle."""
        self.logger.info("cycle_started", incident_id=state.get("incident_id"))

        perceived = await self.perceive(state)
        self.logger.info("perception_complete", keys=list(perceived.keys()))

        suggested_calls = await self.reason(state, perceived)
        validated_calls = self._validate_tool_calls(suggested_calls, state)
        self.logger.info("reasoning_complete", suggested=len(suggested_calls), validated=len(validated_calls))

        if validated_calls:
            limiter = get_agent_rate_limiter()
            if not limiter.check_agent(self.name, role=state.get("role", "analyst")):
                self.logger.warning("agent_rate_limited", agent=self.name)
                log_agent_action(
                    agent_id=self.name,
                    action="rate_limited",
                    payload={"incident_id": state.get("incident_id"), "tool_count": len(validated_calls)},
                )
                return self._apply_observation(
                    state,
                    AgentObservation(
                        agent_id=self.name,
                        action_taken="rate_limited",
                        confidence_score=0.0,
                        tools_used=[],
                        next_state=ObservationNextState.ESCALATE,
                        metadata={"reason": "agent_rate_limit_exceeded"},
                    ),
                )

        tool_results = await self.act(validated_calls, state) if validated_calls else []
        self.logger.info("action_complete", results_count=len(tool_results))

        log_agent_action(
            agent_id=self.name,
            action="cycle_complete",
            payload={
                "incident_id": state.get("incident_id"),
                "tool_calls": [c.get("tool", "") for c in validated_calls],
                "results_count": len(tool_results),
            },
        )

        observation = await self.observe(state, tool_results, validated_calls)
        self.logger.info("observation_complete", action=observation.action_taken, confidence=observation.confidence_score)

        return self._apply_observation(state, observation)

    def _validate_tool_calls(self, tool_calls: List[Dict[str, Any]], state: AgentState) -> List[Dict[str, Any]]:
        is_authorized = state.get("is_authorized", False)
        validated = []
        for call in tool_calls:
            tool_name = call.get("tool", "")
            if self.tool_registry.validate_tool_call(tool_name, is_authorized=is_authorized):
                validated.append(call)
            else:
                self.logger.warning("tool_call_rejected", tool=tool_name, authorized=is_authorized)
        return validated

    def _apply_observation(self, state: AgentState, observation: AgentObservation) -> AgentState:
        observations = list(state.get("agent_observations", []))
        observations.append(observation)
        updates: Dict[str, Any] = {
            "agent_observations": observations,
            "confidence_score": observation.confidence_score,
        }
        if observation.risk_score is not None:
            updates["risk_score"] = observation.risk_score
        if observation.next_state == ObservationNextState.ESCALATE:
            updates["next_step"] = "supervisor"
        elif observation.next_state == ObservationNextState.HALT:
            updates["next_step"] = "end"
        return {**state, **updates}

    async def process_message(self, message: ASOCMessage) -> Optional[ASOCMessage]:
        """Backward-compatible message processor. Delegates to run_cycle()."""
        return None

    async def send_message(self, message: ASOCMessage) -> None:
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

    async def log_event(self, event_type: str, details: Dict[str, Any]) -> None:
        self.logger.info("audit_event", event_type=event_type, details=details)
        try:
            from src.asoc.core.event_store import PostgresEventStore

            store = PostgresEventStore()
            await store.append_event(event_type, details, self.name)
        except Exception as e:
            self.logger.error("event_persist_failed", error=str(e), event_type=event_type)

    def __repr__(self) -> str:
        tools = self.tool_registry.list_tool_names()
        return f"Agent(name={self.name}, type={self.__class__.__name__}, tools={tools})"
