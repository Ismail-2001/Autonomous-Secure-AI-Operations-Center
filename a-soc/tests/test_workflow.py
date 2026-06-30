import pytest

from src.asoc.agents.message import ASOCMessage, MessageType, Priority
from src.asoc.agents.state import create_initial_state
from src.asoc.orchestration.workflow import (
    create_asoc_graph,
    get_initial_state,
)
from src.asoc.orchestration.routing import (
    route_after_telemetry,
    route_after_detection,
    route_after_supervisor,
)


@pytest.mark.asyncio
async def test_telemetry_routes_to_detection():
    state = create_initial_state()
    state["confidence_score"] = 0.9
    result = route_after_telemetry(state)
    assert result == "detection"


@pytest.mark.asyncio
async def test_detection_routes_to_supervisor():
    state = create_initial_state()
    state["confidence_score"] = 0.8
    state["risk_score"] = 0.5
    result = route_after_detection(state)
    assert result == "supervisor"


@pytest.mark.asyncio
async def test_supervisor_node_high_risk():
    state = create_initial_state()
    state["risk_score"] = 0.9
    result = route_after_supervisor(state)
    assert result == "hitl"


@pytest.mark.asyncio
async def test_supervisor_node_low_risk():
    state = create_initial_state()
    state["risk_score"] = 0.3
    result = route_after_supervisor(state)
    assert result == "response"


@pytest.mark.asyncio
async def test_supervisor_node_medium_risk_authorized():
    state = create_initial_state()
    state["risk_score"] = 0.7
    state["is_authorized"] = True
    result = route_after_supervisor(state)
    assert result == "forensics"


def test_create_graph():
    graph = create_asoc_graph()
    assert graph is not None
    assert hasattr(graph, "invoke")


def test_get_initial_state():
    state = get_initial_state()
    assert state["messages"] == []
    assert state["risk_score"] == 0.0
    assert state["confidence_score"] == 1.0
    assert state["is_authorized"] is False
    assert state["agent_observations"] == []
