from __future__ import annotations

import asyncio
from typing import Any, Callable, Optional

from langgraph.graph import END, StateGraph

from src.asoc.agents.compliance import ComplianceAgent
from src.asoc.agents.detection import DetectionAgent
from src.asoc.agents.forensics import ForensicsAgent
from src.asoc.agents.message import ASOCMessage
from src.asoc.agents.notifications import NotificationAgent
from src.asoc.agents.response import ResponseAgent
from src.asoc.agents.state import AgentState, create_initial_state
from src.asoc.agents.supervisor import SupervisorAgent
from src.asoc.agents.telemetry import TelemetryAgent
from src.asoc.core.checkpoint_config import create_checkpointer, get_or_create_checkpointer, CheckpointConfig
from src.asoc.orchestration.routing import (
    route_after_detection,
    route_after_hitl,
    route_after_response,
    route_after_supervisor,
    route_after_telemetry,
)


def _run_async(coro):
    """Run async code from sync context. Reuses event loop when possible."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(asyncio.run, coro)
            return future.result(timeout=120)
    else:
        return asyncio.run(coro)


def _make_agent_node(agent_cls: Callable, **kwargs) -> Callable:
    def node(state: AgentState) -> dict:
        agent = agent_cls(**kwargs) if kwargs else agent_cls()
        result = _run_async(agent.run_cycle(state))
        return {k: v for k, v in result.items() if k != "messages"}

    return node


def _telemetry_node(state: AgentState) -> dict:
    from src.asoc.agents.telemetry import AWSCloudTrailProvider, TelemetryAgent
    from src.asoc.core.config import settings

    aws_key = settings.AWS_ACCESS_KEY_ID.get_secret_value() if settings.AWS_ACCESS_KEY_ID else None
    aws_secret = settings.AWS_SECRET_ACCESS_KEY.get_secret_value() if settings.AWS_SECRET_ACCESS_KEY else None
    provider = AWSCloudTrailProvider(region=settings.AWS_REGION, access_key_id=aws_key, secret_access_key=aws_secret)
    agent = TelemetryAgent(provider=provider)
    result = _run_async(agent.run_cycle(state))

    updates = {k: v for k, v in result.items() if k != "messages"}
    observations = state.get("agent_observations", [])
    if observations:
        last_obs = observations[-1]
        if hasattr(last_obs, "metadata") and last_obs.metadata.get("events"):
            updates["working_memory"] = {**state.get("working_memory", {}), "events": last_obs.metadata["events"]}
    return updates


def _detection_node(state: AgentState) -> dict:
    agent = DetectionAgent()
    result = _run_async(agent.run_cycle(state))
    return {k: v for k, v in result.items() if k != "messages"}


def _supervisor_node(state: AgentState) -> dict:
    agent = SupervisorAgent()
    incident_id = state.get("incident_id", "")
    run_ctx = agent.get_or_create_run_context(incident_id)
    run_ctx.record_step("supervisor_start", True)
    result = _run_async(agent.run_cycle(state))
    return {k: v for k, v in result.items() if k != "messages"}


def _forensics_node(state: AgentState) -> dict:
    agent = ForensicsAgent()
    result = _run_async(agent.run_cycle(state))
    return {k: v for k, v in result.items() if k != "messages"}


def _response_node(state: AgentState) -> dict:
    agent = ResponseAgent()
    result = _run_async(agent.run_cycle(state))
    return {k: v for k, v in result.items() if k != "messages"}


def _compliance_node(state: AgentState) -> dict:
    agent = ComplianceAgent()
    result = _run_async(agent.run_cycle(state))
    return {k: v for k, v in result.items() if k != "messages"}


def _notification_node(state: AgentState) -> dict:
    agent = NotificationAgent()
    result = _run_async(agent.run_cycle(state))
    return {k: v for k, v in result.items() if k != "messages"}


def _hitl_node(state: AgentState) -> dict:
    latest_obs = state.get("agent_observations", [])[-1] if state.get("agent_observations") else None
    incident_id = state.get("incident_id", "")
    from src.asoc.agents.supervisor import SupervisorAgent

    supervisor = SupervisorAgent()
    run_ctx = supervisor.get_or_create_run_context(incident_id)
    run_ctx.record_step("hitl_awaiting", False, {"reason": "awaiting human approval"})

    return {
        "next_step": "awaiting_approval",
        "working_memory": {
            **state.get("working_memory", {}),
            "hitl_required": True,
            "hitl_reason": latest_obs.metadata if latest_obs else {},
            "run_context_snapshot": run_ctx.model_dump(),
        },
    }


async def _create_graph_async(checkpointer=None):
    """Async graph creation with checkpointer setup."""
    if checkpointer is None:
        checkpointer = await get_or_create_checkpointer()

    workflow = StateGraph(AgentState)

    workflow.add_node("telemetry", _telemetry_node)
    workflow.add_node("detection", _detection_node)
    workflow.add_node("supervisor", _supervisor_node)
    workflow.add_node("forensics", _forensics_node)
    workflow.add_node("response", _response_node)
    workflow.add_node("compliance", _compliance_node)
    workflow.add_node("notification", _notification_node)
    workflow.add_node("hitl", _hitl_node)

    workflow.set_entry_point("telemetry")

    workflow.add_conditional_edges("telemetry", route_after_telemetry, {"detection": "detection", "supervisor": "supervisor"})
    workflow.add_conditional_edges("detection", route_after_detection, {"supervisor": "supervisor", "hitl": "hitl"})
    workflow.add_conditional_edges(
        "supervisor",
        route_after_supervisor,
        {"forensics": "forensics", "response": "response", "hitl": "hitl", "end": END},
    )
    workflow.add_conditional_edges("hitl", route_after_hitl, {"response": "response", "end": END})

    workflow.add_edge("forensics", "response")
    workflow.add_conditional_edges("response", route_after_response, {"compliance": "compliance"})
    workflow.add_edge("compliance", "notification")
    workflow.add_edge("notification", END)

    compile_kwargs = {"checkpointer": checkpointer} if checkpointer else {}
    return workflow.compile(**compile_kwargs)


def create_asoc_graph(checkpointer=None):
    """Create the A-SOC graph with optional checkpointing.

    If checkpointer is None, attempts to create PostgreSQL-backed checkpointer.
    Pass checkpointer=False to explicitly disable checkpointing.
    """
    if checkpointer is False:
        workflow = StateGraph(AgentState)
        workflow.add_node("telemetry", _telemetry_node)
        workflow.add_node("detection", _detection_node)
        workflow.add_node("supervisor", _supervisor_node)
        workflow.add_node("forensics", _forensics_node)
        workflow.add_node("response", _response_node)
        workflow.add_node("compliance", _compliance_node)
        workflow.add_node("notification", _notification_node)
        workflow.add_node("hitl", _hitl_node)
        workflow.set_entry_point("telemetry")
        workflow.add_conditional_edges("telemetry", route_after_telemetry, {"detection": "detection", "supervisor": "supervisor"})
        workflow.add_conditional_edges("detection", route_after_detection, {"supervisor": "supervisor", "hitl": "hitl"})
        workflow.add_conditional_edges("supervisor", route_after_supervisor, {"forensics": "forensics", "response": "response", "hitl": "hitl", "end": END})
        workflow.add_conditional_edges("hitl", route_after_hitl, {"response": "response", "end": END})
        workflow.add_edge("forensics", "response")
        workflow.add_conditional_edges("response", route_after_response, {"compliance": "compliance"})
        workflow.add_edge("compliance", "notification")
        workflow.add_edge("notification", END)
        return workflow.compile()

    return _run_async(_create_graph_async(checkpointer))


def create_checkpoint_config(incident_id: str) -> CheckpointConfig:
    """Create a checkpoint configuration for a specific incident."""
    return CheckpointConfig.for_incident(incident_id)


def get_initial_state() -> AgentState:
    return create_initial_state()
