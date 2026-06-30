"""E2E test: Full threat detection pipeline — telemetry ingestion through remediation."""
import uuid

import pytest


@pytest.mark.e2e
class TestThreatDetectionPipeline:
    """End-to-end pipeline: cloud event -> telemetry -> detection -> supervisor -> response."""

    async def test_critical_threat_triggers_full_pipeline(self, setup_test_state):
        from src.asoc.agents.detection import DetectionAgent
        from src.asoc.agents.response import MockRemediationProvider, ResponseAgent
        from src.asoc.agents.supervisor import SupervisorAgent
        from src.asoc.agents.telemetry import TelemetryAgent

        incident_id = str(uuid.uuid4())
        state = setup_test_state(incident_id)

        telemetry = TelemetryAgent()
        detection = DetectionAgent()
        supervisor = SupervisorAgent()
        response = ResponseAgent(provider=MockRemediationProvider())

        state = await telemetry.run_cycle(state)
        assert len(state.get("agent_observations", [])) > 0

        state = await detection.run_cycle(state)
        obs = state["agent_observations"][-1]
        assert obs.agent_id == "DetectionAgent"

        state = await supervisor.run_cycle(state)
        obs = state["agent_observations"][-1]
        assert obs.agent_id == "SupervisorAgent"

        state["is_authorized"] = True
        state = await response.run_cycle(state)
        obs = state["agent_observations"][-1]
        assert obs.agent_id == "ResponseAgent"

    async def test_pipeline_preserves_incident_id(self, setup_test_state):
        from src.asoc.agents.detection import DetectionAgent
        from src.asoc.agents.telemetry import TelemetryAgent

        incident_id = str(uuid.uuid4())
        state = setup_test_state(incident_id)

        telemetry = TelemetryAgent()
        state = await telemetry.run_cycle(state)
        assert state.get("incident_id") == incident_id

        detection = DetectionAgent()
        state = await detection.run_cycle(state)
        assert state.get("incident_id") == incident_id

    async def test_pipeline_handles_no_events_gracefully(self, setup_test_state):
        from src.asoc.agents.telemetry import TelemetryAgent

        state = setup_test_state(str(uuid.uuid4()))
        state["working_memory"] = {}

        telemetry = TelemetryAgent()
        state = await telemetry.run_cycle(state)
        obs = state["agent_observations"][-1]
        assert obs.confidence_score <= 0.5 or obs.action_taken == "no_events_found"
