import pytest
from unittest.mock import patch

from src.asoc.agents.message import ASOCMessage, MessageType, Priority
from src.asoc.agents.state import AgentState, create_initial_state
from src.asoc.orchestration.workflow import (
    create_asoc_graph,
    get_initial_state,
)
from src.asoc.orchestration.routing import (
    route_after_telemetry,
    route_after_detection,
    route_after_supervisor,
    route_after_hitl,
)


def _make_state(**overrides) -> AgentState:
    state = create_initial_state()
    state.update(overrides)
    return state


def _make_message(msg_type=MessageType.ALERT, source="TelemetryAgent", payload=None) -> ASOCMessage:
    return ASOCMessage(
        message_type=msg_type,
        source_agent=source,
        payload=payload or {"event": {"eventName": "ConsoleLogin", "sourceIPAddress": "1.2.3.4"}},
    )


# ── Graph Construction Tests ────────────────────────────────────────────────


class TestGraphConstruction:
    def test_graph_creates_successfully(self):
        graph = create_asoc_graph()
        assert graph is not None
        assert hasattr(graph, "invoke")

    def test_get_initial_state(self):
        state = get_initial_state()
        assert state["messages"] == []
        assert state["risk_score"] == 0.0
        assert state["confidence_score"] == 1.0
        assert state["agent_observations"] == []


# ── Routing Function Tests ──────────────────────────────────────────────────


class TestRoutingFunctions:
    def test_route_after_telemetry_normal(self):
        state = _make_state(confidence_score=0.9)
        assert route_after_telemetry(state) == "detection"

    def test_route_after_telemetry_low_confidence(self):
        state = _make_state(confidence_score=0.3)
        assert route_after_telemetry(state) == "supervisor"

    def test_route_after_detection_high_confidence_low_risk(self):
        state = _make_state(confidence_score=0.8, risk_score=0.5)
        assert route_after_detection(state) == "supervisor"

    def test_route_after_detection_low_confidence(self):
        state = _make_state(confidence_score=0.5, risk_score=0.5)
        assert route_after_detection(state) == "supervisor"

    def test_route_after_detection_high_risk(self):
        state = _make_state(confidence_score=0.9, risk_score=0.85)
        assert route_after_detection(state) == "hitl"

    def test_route_after_supervisor_low_risk(self):
        state = _make_state(risk_score=0.3, is_authorized=False)
        assert route_after_supervisor(state) == "response"

    def test_route_after_supervisor_high_risk_unauthorized(self):
        state = _make_state(risk_score=0.85, is_authorized=False)
        assert route_after_supervisor(state) == "hitl"

    def test_route_after_supervisor_high_risk_authorized(self):
        state = _make_state(risk_score=0.85, is_authorized=True)
        assert route_after_supervisor(state) == "forensics"

    def test_route_after_supervisor_very_high_risk(self):
        state = _make_state(risk_score=0.96, is_authorized=False)
        assert route_after_supervisor(state) == "hitl"

    def test_route_after_supervisor_explicit_end(self):
        state = _make_state(risk_score=0.5, next_step="end")
        assert route_after_supervisor(state) == "end"

    def test_route_after_hitl_authorized(self):
        state = _make_state(is_authorized=True)
        assert route_after_hitl(state) == "response"

    def test_route_after_hitl_not_authorized(self):
        state = _make_state(is_authorized=False)
        assert route_after_hitl(state) == "end"


# ── Conditional Edge Tests ──────────────────────────────────────────────────


class TestConditionalEdges:
    def test_telemetry_to_detection(self):
        state = _make_state(confidence_score=0.9)
        assert route_after_telemetry(state) == "detection"

    def test_telemetry_to_supervisor_on_low_confidence(self):
        state = _make_state(confidence_score=0.3)
        assert route_after_telemetry(state) == "supervisor"

    def test_detection_to_supervisor_on_safe(self):
        state = _make_state(confidence_score=0.8, risk_score=0.5)
        assert route_after_detection(state) == "supervisor"

    def test_detection_to_hitl_on_high_risk(self):
        state = _make_state(confidence_score=0.9, risk_score=0.85)
        assert route_after_detection(state) == "hitl"

    def test_supervisor_to_forensics_on_medium_risk(self):
        state = _make_state(risk_score=0.7, is_authorized=True)
        assert route_after_supervisor(state) == "forensics"

    def test_supervisor_to_response_on_low_risk(self):
        state = _make_state(risk_score=0.3)
        assert route_after_supervisor(state) == "response"

    def test_supervisor_to_hitl_on_high_risk(self):
        state = _make_state(risk_score=0.85, is_authorized=False)
        assert route_after_supervisor(state) == "hitl"

    def test_hitl_to_response_when_approved(self):
        state = _make_state(is_authorized=True)
        assert route_after_hitl(state) == "response"

    def test_hitl_to_end_when_rejected(self):
        state = _make_state(is_authorized=False)
        assert route_after_hitl(state) == "end"


# ── State Mutation Tests ────────────────────────────────────────────────────


class TestStateMutations:
    def test_risk_score_propagates(self):
        state = _make_state(risk_score=0.85)
        assert state["risk_score"] == 0.85

    def test_confidence_score_propagates(self):
        state = _make_state(confidence_score=0.6)
        assert state["confidence_score"] == 0.6

    def test_observations_append(self):
        from src.asoc.agents.observation import AgentObservation, ObservationNextState

        state = _make_state()
        obs = AgentObservation(
            agent_id="TestAgent", action_taken="test", confidence_score=0.8,
            tools_used=[], next_state=ObservationNextState.CONTINUE,
        )
        state["agent_observations"].append(obs)
        assert len(state["agent_observations"]) == 1

    def test_working_memory_persists(self):
        state = _make_state(working_memory={"key": "value"})
        assert state["working_memory"]["key"] == "value"
