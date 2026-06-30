"""E2E test: OPA policy enforcement blocks unauthorized high-risk actions."""
import uuid

import pytest


@pytest.mark.e2e
class TestOPAPolicyBlock:
    """Verify OPA blocks actions that violate guardrails."""

    async def test_high_risk_action_blocked_by_opa(self, setup_test_state):
        from src.asoc.agents.supervisor import SupervisorAgent

        incident_id = str(uuid.uuid4())
        state = setup_test_state(incident_id)
        state["risk_score"] = 0.95
        state["is_authorized"] = False

        supervisor = SupervisorAgent()
        result = await supervisor.tool_registry.execute(
            "query_opa_policy",
            agent_name="ResponseAgent",
            action={"type": "ISOLATE_INSTANCE", "is_destructive": True, "target": "i-098f6bcd4621d373c"},
            risk_score=0.95,
        )
        assert result is False

    async def test_low_risk_action_allowed_by_opa(self, setup_test_state):
        from src.asoc.agents.supervisor import SupervisorAgent

        supervisor = SupervisorAgent()
        result = await supervisor.tool_registry.execute(
            "query_opa_policy",
            agent_name="DetectionAgent",
            action={"type": "READ_ONLY_QUERY", "is_destructive": False},
            risk_score=0.3,
        )
        assert result is True

    async def test_supervisor_routes_high_risk_to_hitl(self, setup_test_state):
        from src.asoc.agents.supervisor import SupervisorAgent

        incident_id = str(uuid.uuid4())
        state = setup_test_state(incident_id)
        state["risk_score"] = 0.9
        state["is_authorized"] = False

        supervisor = SupervisorAgent()
        state = await supervisor.run_cycle(state)
        obs = state["agent_observations"][-1]
        assert obs.next_state.value in ("escalate", "halt")
