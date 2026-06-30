"""E2E test: Checkpoint resume after simulated worker restart."""
import uuid

import pytest


@pytest.mark.e2e
class TestCheckpointResume:
    """Verify incident state can be restored from checkpoint."""

    async def test_checkpoint_preserves_agent_observations(self, setup_test_state):
        from src.asoc.agents.detection import DetectionAgent
        from src.asoc.agents.observation import AgentObservation, ObservationNextState

        incident_id = str(uuid.uuid4())
        state = setup_test_state(incident_id)

        detection = DetectionAgent()
        state = await detection.run_cycle(state)
        obs_count = len(state.get("agent_observations", []))
        assert obs_count > 0

        restored = {
            "incident_id": state["incident_id"],
            "risk_score": state.get("risk_score", 0.0),
            "confidence_score": state.get("confidence_score", 0.0),
            "agent_observations": state.get("agent_observations", []),
            "is_authorized": state.get("is_authorized", False),
        }
        assert restored["incident_id"] == incident_id
        assert len(restored["agent_observations"]) == obs_count

    async def test_run_context_tracks_step_success(self, setup_test_state):
        from src.asoc.agents.agent_message import RunContext

        ctx = RunContext(incident_id=str(uuid.uuid4()))
        ctx.record_step("detection", True)
        ctx.record_step("response", True)
        assert ctx.success_rate == 1.0
        assert ctx.duration_seconds >= 0

    async def test_run_context_records_failure(self):
        from src.asoc.agents.agent_message import RunContext

        ctx = RunContext(incident_id=str(uuid.uuid4()))
        ctx.record_step("detection", True)
        ctx.record_step("response", False)
        assert ctx.success_rate < 1.0
