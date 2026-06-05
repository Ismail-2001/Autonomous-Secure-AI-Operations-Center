import pytest

from agents.base.message import ASOCMessage, MessageType, Priority
from core.orchestration.workflow import (
    AgentState,
    create_asoc_graph,
    detection_node,
    forensics_node,
    response_node,
    supervisor_node,
    telemetry_node,
)


@pytest.mark.asyncio
async def test_telemetry_node():
    state = AgentState(messages=[], incident_id="", risk_score=0.0, next_step="", is_authorized=False)
    result = await telemetry_node(state)
    assert result["next_step"] == "detection"


@pytest.mark.asyncio
async def test_detection_node():
    msg = ASOCMessage(message_type=MessageType.ALERT, source_agent="test", payload={"event": "test"})
    state = AgentState(messages=[msg], incident_id="i1", risk_score=0.0, next_step="", is_authorized=False)
    result = await detection_node(state)
    assert result["next_step"] == "supervisor"
    assert result["risk_score"] == 0.85


@pytest.mark.asyncio
async def test_supervisor_node_high_risk():
    state = AgentState(messages=[], incident_id="i1", risk_score=0.9, next_step="", is_authorized=False)
    result = await supervisor_node(state)
    assert result["next_step"] == "forensics"
    assert result["is_authorized"] is True


@pytest.mark.asyncio
async def test_supervisor_node_low_risk():
    state = AgentState(messages=[], incident_id="i1", risk_score=0.5, next_step="", is_authorized=False)
    result = await supervisor_node(state)
    assert result["next_step"] == "end"


@pytest.mark.asyncio
async def test_forensics_node():
    state = AgentState(messages=[], incident_id="i1", risk_score=0.9, next_step="supervisor", is_authorized=True)
    result = await forensics_node(state)
    assert result["next_step"] == "response"


@pytest.mark.asyncio
async def test_response_node():
    state = AgentState(messages=[], incident_id="i1", risk_score=0.9, next_step="forensics", is_authorized=True)
    result = await response_node(state)
    assert result["next_step"] == "end"


def test_create_graph():
    graph = create_asoc_graph()
    assert graph is not None
    assert hasattr(graph, "invoke")
