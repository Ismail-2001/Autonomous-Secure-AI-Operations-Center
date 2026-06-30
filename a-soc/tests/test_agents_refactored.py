import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from src.asoc.agents.message import ASOCMessage, MessageType, Priority
from src.asoc.agents.observation import AgentObservation, ObservationNextState
from src.asoc.agents.state import AgentState, create_initial_state
from src.asoc.agents.tools import ToolRegistry
from src.asoc.agents.detection import DetectionAgent
from src.asoc.agents.supervisor import SupervisorAgent
from src.asoc.agents.forensics import ForensicsAgent
from src.asoc.agents.response import ResponseAgent, MockRemediationProvider
from src.asoc.agents.compliance import ComplianceAgent
from src.asoc.agents.notifications import NotificationAgent
from src.asoc.agents.telemetry import TelemetryAgent
from src.asoc.llm.providers import LLMResult


def _make_state(**overrides) -> AgentState:
    state = create_initial_state()
    state.update(overrides)
    return state


def _make_message(msg_type=MessageType.ALERT, source="TestAgent", payload=None, correlation_id=None, priority=Priority.MEDIUM) -> ASOCMessage:
    return ASOCMessage(
        message_type=msg_type,
        source_agent=source,
        payload=payload or {"event": {"eventName": "ConsoleLogin", "sourceIPAddress": "1.2.3.4"}},
        correlation_id=correlation_id,
        priority=priority,
    )


# ── ToolRegistry Tests ──────────────────────────────────────────────────────


class TestToolRegistry:
    def test_register_and_list(self):
        registry = ToolRegistry()
        registry.register("test_tool", AsyncMock(), "A test tool")
        assert "test_tool" in registry.list_tool_names()
        assert len(registry.list_tools()) == 1

    def test_get_tool(self):
        registry = ToolRegistry()
        mock_func = AsyncMock(return_value="result")
        registry.register("test_tool", mock_func, "desc")
        tool = registry.get("test_tool")
        assert tool is not None
        assert tool.name == "test_tool"

    def test_get_nonexistent_returns_none(self):
        registry = ToolRegistry()
        assert registry.get("nonexistent") is None

    @pytest.mark.asyncio
    async def test_execute_tool(self):
        registry = ToolRegistry()
        mock_func = AsyncMock(return_value={"status": "ok"})
        registry.register("test_tool", mock_func, "desc")
        result = await registry.execute("test_tool", arg1="value1")
        assert result == {"status": "ok"}
        mock_func.assert_called_once_with(arg1="value1")

    @pytest.mark.asyncio
    async def test_execute_nonexistent_raises(self):
        registry = ToolRegistry()
        with pytest.raises(ValueError, match="not registered"):
            await registry.execute("nonexistent")

    def test_validate_tool_call(self):
        registry = ToolRegistry()
        registry.register("safe_tool", AsyncMock(), "safe", requires_authorization=False)
        registry.register("risky_tool", AsyncMock(), "risky", requires_authorization=True)

        assert registry.validate_tool_call("safe_tool") is True
        assert registry.validate_tool_call("risky_tool", is_authorized=False) is False
        assert registry.validate_tool_call("risky_tool", is_authorized=True) is True
        assert registry.validate_tool_call("unknown_tool") is False
        assert registry.validate_tool_call("safe_tool", rate_limited=True) is False


# ── Observation Tests ────────────────────────────────────────────────────────


class TestAgentObservation:
    def test_create_observation(self):
        obs = AgentObservation(
            agent_id="TestAgent",
            action_taken="test_action",
            confidence_score=0.85,
            tools_used=["tool1"],
            next_state=ObservationNextState.CONTINUE,
        )
        assert obs.agent_id == "TestAgent"
        assert obs.confidence_score == 0.85
        assert obs.observation_id is not None
        assert obs.timestamp is not None

    def test_observation_defaults(self):
        obs = AgentObservation(
            agent_id="A", action_taken="x", confidence_score=0.5, tools_used=[], next_state=ObservationNextState.CONTINUE
        )
        assert obs.risk_score is None
        assert obs.metadata == {}
        assert obs.error is None
        assert obs.retry_count == 0


# ── DetectionAgent Tests ─────────────────────────────────────────────────────


class TestDetectionAgent:
    @pytest.mark.asyncio
    async def test_perceive_extracts_event_data(self):
        agent = DetectionAgent(provider=MagicMock(name="mock"))
        msg = _make_message()
        state = _make_state(messages=[msg])
        perceived = await agent.perceive(state)
        assert "event_data" in perceived
        assert perceived["event_data"]["eventName"] == "ConsoleLogin"

    @pytest.mark.asyncio
    async def test_reason_returns_tool_calls(self):
        agent = DetectionAgent(provider=MagicMock(name="mock"))
        perceived = {"event_data": {"eventName": "ConsoleLogin"}}
        state = _make_state()
        calls = await agent.reason(state, perceived)
        tool_names = [c["tool"] for c in calls]
        assert "analyze_threat_llm" in tool_names
        assert "map_mitre_technique" in tool_names
        assert "calculate_risk_score" in tool_names

    @pytest.mark.asyncio
    async def test_act_executes_tools(self):
        agent = DetectionAgent(provider=MagicMock(name="mock"))
        tool_calls = [
            {"tool": "analyze_threat_llm", "args": {"event_data": {"eventName": "ConsoleLogin"}}},
            {"tool": "map_mitre_technique", "args": {"event_data": {"eventName": "ConsoleLogin"}}},
            {"tool": "calculate_risk_score", "args": {"llm_result": {}, "mitre": None, "event_data": {}}},
        ]
        results = await agent.act(tool_calls, _make_state())
        assert len(results) == 3

    @pytest.mark.asyncio
    async def test_observe_emits_observation(self):
        agent = DetectionAgent(provider=MagicMock(name="mock"))
        tool_results = [
            {"risk_score": 0.85, "reasoning": "test"},
            {"technique_id": "T1078"},
            {"final_risk_score": 0.9, "confidence": 0.8},
        ]
        state = _make_state(risk_score=0.9)
        obs = await agent.observe(state, tool_results, [{"tool": "analyze_threat_llm"}])
        assert isinstance(obs, AgentObservation)
        assert obs.agent_id == "DetectionAgent"
        assert obs.risk_score == 0.9
        assert obs.confidence_score == 0.8

    @pytest.mark.asyncio
    async def test_observe_escalates_on_low_confidence(self):
        agent = DetectionAgent(provider=MagicMock(name="mock"))
        tool_results = [{"risk_score": 0.3}, None, {"final_risk_score": 0.3, "confidence": 0.4}]
        obs = await agent.observe(_make_state(), tool_results, [{"tool": "x"}])
        assert obs.next_state == ObservationNextState.ESCALATE

    @pytest.mark.asyncio
    async def test_analyze_threat_uses_llm(self):
        mock_provider = AsyncMock()
        mock_provider.name = "test:mock"
        mock_provider.analyze.return_value = LLMResult(
            threat_detected=True, risk_score=0.75, reasoning="Test reasoning", attack_technique="T1078"
        )
        agent = DetectionAgent(provider=mock_provider)
        result = await agent.analyze_threat({"eventName": "ConsoleLogin"})
        assert result.payload["risk_score"] == 0.75
        assert result.payload["attack_technique"] == "T1078"

    @pytest.mark.asyncio
    async def test_analyze_threat_fallback_on_provider_failure(self):
        mock_provider = AsyncMock()
        mock_provider.name = "test:fail"
        mock_provider.analyze.side_effect = Exception("API down")
        agent = DetectionAgent(provider=mock_provider)
        result = await agent.analyze_threat({"eventName": "ConsoleLogin"})
        assert result is not None
        assert "risk_score" in result.payload


# ── SupervisorAgent Tests ────────────────────────────────────────────────────


class TestSupervisorAgent:
    @pytest.mark.asyncio
    async def test_perceive_extracts_risk_and_auth(self):
        agent = SupervisorAgent()
        state = _make_state(risk_score=0.85, is_authorized=False, incident_id="inc-123")
        perceived = await agent.perceive(state)
        assert perceived["risk_score"] == 0.85
        assert perceived["is_authorized"] is False
        assert perceived["incident_id"] == "inc-123"

    @pytest.mark.asyncio
    async def test_reason_returns_routing_tools(self):
        agent = SupervisorAgent()
        perceived = {"risk_score": 0.85, "is_authorized": False, "latest_observation": {}, "incident_id": "x"}
        calls = await agent.reason(_make_state(), perceived)
        tool_names = [c["tool"] for c in calls]
        assert "route_by_risk" in tool_names
        assert "query_opa_policy" in tool_names

    @pytest.mark.asyncio
    async def test_route_by_risk_high_unauthorized_goes_hitl(self):
        agent = SupervisorAgent()
        result = await agent._tool_route_by_risk(0.85, False)
        assert result == "hitl"

    @pytest.mark.asyncio
    async def test_route_by_risk_low_goes_auto(self):
        agent = SupervisorAgent()
        result = await agent._tool_route_by_risk(0.3, False)
        assert result == "auto_approve"

    @pytest.mark.asyncio
    async def test_route_by_risk_very_high_blocks(self):
        agent = SupervisorAgent()
        result = await agent._tool_route_by_risk(0.96, False)
        assert result == "block"

    @pytest.mark.asyncio
    async def test_observe_returns_escalate_for_hitl(self):
        agent = SupervisorAgent()
        state = _make_state(risk_score=0.85, is_authorized=False)
        obs = await agent.observe(state, ["hitl"], [{"tool": "route_by_risk"}])
        assert obs.next_state == ObservationNextState.ESCALATE
        assert "routed_to_hitl" in obs.action_taken

    @pytest.mark.asyncio
    async def test_observe_returns_continue_for_forensics(self):
        agent = SupervisorAgent()
        obs = await agent.observe(_make_state(), ["forensics"], [{"tool": "route_by_risk"}])
        assert obs.next_state == ObservationNextState.CONTINUE

    @pytest.mark.asyncio
    async def test_quality_check_passes_high_confidence(self):
        agent = SupervisorAgent()
        obs = AgentObservation(
            agent_id="DetectionAgent", action_taken="x", confidence_score=0.8, tools_used=[], next_state=ObservationNextState.CONTINUE
        )
        result = await agent.quality_check(obs)
        assert result.confidence_score == 0.8

    @pytest.mark.asyncio
    async def test_quality_check_escalates_low_confidence(self):
        agent = SupervisorAgent()
        obs = AgentObservation(
            agent_id="DetectionAgent", action_taken="x", confidence_score=0.3, tools_used=[], next_state=ObservationNextState.CONTINUE
        )
        result = await agent.quality_check(obs)
        assert result.action_taken == "quality_check_failed_reinvoke"
        assert result.next_state == ObservationNextState.ESCALATE

    @pytest.mark.asyncio
    async def test_quality_check_max_retries_escalates(self):
        agent = SupervisorAgent()
        obs = AgentObservation(
            agent_id="DetectionAgent", action_taken="x", confidence_score=0.3, tools_used=[], next_state=ObservationNextState.CONTINUE
        )
        for _ in range(4):
            result = await agent.quality_check(obs)
        assert result.action_taken == "quality_check_failed_reinvoke"

    @pytest.mark.asyncio
    async def test_process_message_alert_routes_to_forensics(self):
        agent = SupervisorAgent()
        msg = _make_message(
            payload={"risk_score": 0.75, "reasoning": "test"},
            correlation_id="inc-001",
        )
        result = await agent.process_message(msg)
        assert result is not None
        assert result.target_agent == "ForensicsAgent"

    @pytest.mark.asyncio
    async def test_process_message_high_risk_routes_to_response(self):
        agent = SupervisorAgent()
        msg = _make_message(
            payload={"risk_score": 0.85, "reasoning": "critical threat", "action": "REVOKE_IAM"},
            correlation_id="inc-002",
        )
        result = await agent.process_message(msg)
        assert result is not None
        assert result.target_agent == "ResponseAgent"

    @pytest.mark.asyncio
    async def test_active_incidents_tracked(self):
        agent = SupervisorAgent()
        msg = _make_message(payload={"risk_score": 0.7}, correlation_id="inc-003")
        await agent.process_message(msg)
        assert "inc-003" in agent.active_incidents


# ── ForensicsAgent Tests ─────────────────────────────────────────────────────


class TestForensicsAgent:
    @pytest.mark.asyncio
    async def test_build_blast_radius_creates_nodes(self):
        agent = ForensicsAgent()
        incident = {"source_ip": "1.2.3.4", "user": "admin"}
        events = [{"eventName": "ListBuckets", "resources": [{"name": "s3://bucket"}]}]
        result = await agent._tool_build_blast_radius(incident, events)
        assert len(result["nodes"]) >= 2
        assert len(result["edges"]) >= 1

    @pytest.mark.asyncio
    async def test_reconstruct_timeline_sorts_events(self):
        agent = ForensicsAgent()
        events = [
            {"eventTime": "2024-01-01T12:01:00Z", "eventName": "ListBuckets"},
            {"eventTime": "2024-01-01T12:00:00Z", "eventName": "ConsoleLogin"},
        ]
        timeline = await agent._tool_reconstruct_timeline(events)
        assert timeline[0]["action"] == "ConsoleLogin"
        assert timeline[1]["action"] == "ListBuckets"

    @pytest.mark.asyncio
    async def test_observe_returns_forensics_observation(self):
        agent = ForensicsAgent()
        state = _make_state()
        tool_results = [{"similar_incidents": []}, {"nodes": [], "edges": []}, []]
        obs = await agent.observe(state, tool_results, [{"tool": "x"}])
        assert obs.agent_id == "ForensicsAgent"
        assert obs.action_taken == "forensics_analysis_complete"

    @pytest.mark.asyncio
    async def test_perceive_extracts_incident(self):
        agent = ForensicsAgent()
        msg = _make_message(payload={"incident_id": "inc-1"})
        state = _make_state(messages=[msg], incident_id="inc-1")
        perceived = await agent.perceive(state)
        assert perceived["incident_id"] == "inc-1"

    @pytest.mark.asyncio
    async def test_analyze_incident_queries_vector_store(self):
        agent = ForensicsAgent()
        result = await agent.analyze_incident({"incident_id": "inc-001", "data": {}})
        assert "root_cause" in result
        assert "blast_radius" in result


# ── ResponseAgent Tests ──────────────────────────────────────────────────────


class TestResponseAgent:
    @pytest.mark.asyncio
    async def test_mock_provider_blocks_ip(self):
        provider = MockRemediationProvider()
        result = await provider.block_ip("1.2.3.4", "test")
        assert result is True

    @pytest.mark.asyncio
    async def test_mock_provider_revokes_iam(self):
        provider = MockRemediationProvider()
        result = await provider.revoke_iam_access("admin", "test")
        assert result is True

    @pytest.mark.asyncio
    async def test_action_to_tool_mapping(self):
        agent = ResponseAgent()
        assert agent._action_to_tool("BLOCK_IP") == "block_ip_address"
        assert agent._action_to_tool("REVOKE_IAM") == "revoke_iam_access"
        assert agent._action_to_tool("ISOLATE_INSTANCE") == "isolate_instance"
        assert agent._action_to_tool("QUARANTINE_S3") == "quarantine_s3_bucket"
        assert agent._action_to_tool("UNKNOWN_ACTION") is None

    @pytest.mark.asyncio
    async def test_perceive_extracts_action_and_target(self):
        agent = ResponseAgent()
        msg = _make_message(
            msg_type=MessageType.COMMAND,
            source="SupervisorAgent",
            payload={"action": "BLOCK_IP", "target": "1.2.3.4"},
        )
        state = _make_state(messages=[msg], is_authorized=True)
        perceived = await agent.perceive(state)
        assert perceived["action"] == "BLOCK_IP"
        assert perceived["is_authorized"] is True

    @pytest.mark.asyncio
    async def test_reason_empty_when_unauthorized(self):
        agent = ResponseAgent()
        perceived = {"action": "BLOCK_IP", "target": "1.2.3.4", "is_authorized": False}
        calls = await agent.reason(_make_state(), perceived)
        assert calls == []

    @pytest.mark.asyncio
    async def test_reason_returns_tool_calls_when_authorized(self):
        agent = ResponseAgent()
        perceived = {"action": "BLOCK_IP", "target": "1.2.3.4", "is_authorized": True}
        calls = await agent.reason(_make_state(), perceived)
        assert len(calls) >= 1
        assert calls[0]["tool"] == "block_ip_address"

    @pytest.mark.asyncio
    async def test_observe_success(self):
        agent = ResponseAgent()
        obs = await agent.observe(_make_state(), [True, True], [{"tool": "block_ip_address"}, {"tool": "verify_remediation"}])
        assert obs.action_taken == "remediation_executed"
        assert obs.confidence_score == 0.95

    @pytest.mark.asyncio
    async def test_observe_failure(self):
        agent = ResponseAgent()
        obs = await agent.observe(_make_state(), [False], [{"tool": "block_ip_address"}])
        assert obs.action_taken == "remediation_failed"

    @pytest.mark.asyncio
    async def test_process_message_executes_remediation(self):
        agent = ResponseAgent()
        msg = _make_message(
            msg_type=MessageType.COMMAND,
            source="SupervisorAgent",
            target_agent="ResponseAgent",
            payload={"action": "BLOCK_IP", "target": "1.2.3.4"},
        )
        result = await agent.process_message(msg)
        assert result is not None
        assert result.payload["success"] is True


# ── ComplianceAgent Tests ────────────────────────────────────────────────────


class TestComplianceAgent:
    @pytest.mark.asyncio
    async def test_map_to_frameworks_known_event(self):
        agent = ComplianceAgent()
        controls = await agent._tool_map_to_frameworks("revoked_access")
        assert "SOC2.CC6.1" in controls

    @pytest.mark.asyncio
    async def test_map_to_frameworks_unknown_event(self):
        agent = ComplianceAgent()
        controls = await agent._tool_map_to_frameworks("unknown_event")
        assert "GENERAL_SECURITY_ALERT" in controls

    @pytest.mark.asyncio
    async def test_infer_event_type_console_login(self):
        agent = ComplianceAgent()
        assert agent._infer_event_type({"event": {"eventName": "ConsoleLogin"}}) == "suspicious_console_login"

    @pytest.mark.asyncio
    async def test_infer_event_type_delete_bucket(self):
        agent = ComplianceAgent()
        assert agent._infer_event_type({"action": "DeleteBucket"}) == "data_exfiltration"

    @pytest.mark.asyncio
    async def test_generate_report(self):
        agent = ComplianceAgent()
        report = await agent._tool_generate_report("revoked_access", ["SOC2.CC6.1"])
        assert report["event_type"] == "revoked_access"
        assert report["remediation_required"] is True

    @pytest.mark.asyncio
    async def test_observe_emits_observation(self):
        agent = ComplianceAgent()
        state = _make_state()
        tool_results = [["SOC2.CC6.1"], {"event_type": "test"}]
        obs = await agent.observe(state, tool_results, [{"tool": "map_to_frameworks"}])
        assert obs.agent_id == "ComplianceAgent"
        assert obs.confidence_score == 0.85

    @pytest.mark.asyncio
    async def test_process_message_logs_finding(self):
        agent = ComplianceAgent()
        msg = _make_message(
            msg_type=MessageType.LOG,
            source="ResponseAgent",
            payload={"event_type": "revoked_access", "details": {"user": "admin"}},
        )
        result = await agent.process_message(msg)
        assert result is None


# ── NotificationAgent Tests ──────────────────────────────────────────────────


class TestNotificationAgent:
    @pytest.mark.asyncio
    async def test_format_message(self):
        agent = NotificationAgent(providers=[])
        result = await agent._tool_format_message("DetectionAgent", {"reasoning": "test"}, "HIGH")
        assert result["title"] == "A-SOC Alert: DetectionAgent"
        assert result["severity"] == "high"

    @pytest.mark.asyncio
    async def test_send_alert_no_providers(self):
        agent = NotificationAgent(providers=[])
        result = await agent.send_alert("title", "message")
        assert result is False

    @pytest.mark.asyncio
    async def test_observe_counts_sent(self):
        agent = NotificationAgent(providers=[])
        obs = await agent.observe(_make_state(), [True, False], [{"tool": "send_slack"}, {"tool": "send_teams"}])
        assert obs.metadata["sent_count"] == 1

    @pytest.mark.asyncio
    async def test_perceive_extracts_message(self):
        agent = NotificationAgent(providers=[])
        msg = _make_message()
        state = _make_state(messages=[msg])
        perceived = await agent.perceive(state)
        assert perceived["message"] is not None


# ── TelemetryAgent Tests ─────────────────────────────────────────────────────


class TestTelemetryAgent:
    @pytest.mark.asyncio
    async def test_filter_events_by_risk(self):
        agent = TelemetryAgent(provider=MagicMock())
        events = [
            {"eventName": "ConsoleLogin"},
            {"eventName": "ListObjects"},
        ]
        filtered = await agent._tool_filter_events_by_risk(events, min_risk=0.5)
        assert len(filtered) == 1
        assert filtered[0]["eventName"] == "ConsoleLogin"

    @pytest.mark.asyncio
    async def test_observe_with_events(self):
        agent = TelemetryAgent(provider=MagicMock())
        state = _make_state()
        tool_results = [[{"eventID": "e1", "eventName": "ConsoleLogin"}]]
        obs = await agent.observe(state, tool_results, [{"tool": "fetch_cloud_events"}])
        assert obs.action_taken == "fetched_cloud_events"
        assert obs.confidence_score == 0.9

    @pytest.mark.asyncio
    async def test_observe_without_events_halts(self):
        agent = TelemetryAgent(provider=MagicMock())
        obs = await agent.observe(_make_state(), [[]], [{"tool": "fetch_cloud_events"}])
        assert obs.next_state == ObservationNextState.HALT

    @pytest.mark.asyncio
    async def test_perceive_checks_provider_health(self):
        mock_provider = AsyncMock()
        mock_provider.health_check.return_value = True
        agent = TelemetryAgent(provider=mock_provider)
        perceived = await agent.perceive(_make_state())
        assert perceived["provider_healthy"] is True

    @pytest.mark.asyncio
    async def test_poll_cloudtrail_with_events(self):
        from src.asoc.agents.telemetry import CloudEvent

        mock_event = CloudEvent(
            event_id="test-1", event_name="ConsoleLogin", event_time="2024-01-01T12:00:00Z",
            source_ip="1.2.3.4", user_identity={"type": "IAMUser", "userName": "admin"}, resources=[], raw={},
        )
        mock_provider = AsyncMock()
        mock_provider.fetch_events.return_value = [mock_event]
        agent = TelemetryAgent(provider=mock_provider)
        result = await agent.poll_cloudtrail()
        assert result is not None
        assert result.message_type == MessageType.ALERT

    @pytest.mark.asyncio
    async def test_poll_cloudtrail_empty_returns_none(self):
        mock_provider = AsyncMock()
        mock_provider.fetch_events.return_value = []
        agent = TelemetryAgent(provider=mock_provider)
        result = await agent.poll_cloudtrail()
        assert result is None


# ── Run Cycle Integration Tests ─────────────────────────────────────────────


class TestRunCycle:
    @pytest.mark.asyncio
    async def test_detection_run_cycle(self):
        mock_provider = AsyncMock()
        mock_provider.name = "test:mock"
        mock_provider.analyze.return_value = LLMResult(
            threat_detected=True, risk_score=0.75, reasoning="Test analysis"
        )
        agent = DetectionAgent(provider=mock_provider)
        msg = _make_message()
        state = _make_state(messages=[msg])
        result = await agent.run_cycle(state)
        assert "agent_observations" in result
        assert len(result["agent_observations"]) > 0
        obs = result["agent_observations"][-1]
        assert obs.agent_id == "DetectionAgent"

    @pytest.mark.asyncio
    async def test_compliance_run_cycle(self):
        agent = ComplianceAgent()
        msg = _make_message(msg_type=MessageType.LOG, payload={"event_type": "revoked_access"})
        state = _make_state(messages=[msg])
        result = await agent.run_cycle(state)
        obs = result["agent_observations"][-1]
        assert obs.agent_id == "ComplianceAgent"

    @pytest.mark.asyncio
    async def test_response_run_cycle_unauthorized(self):
        agent = ResponseAgent()
        msg = _make_message(
            msg_type=MessageType.COMMAND,
            payload={"action": "BLOCK_IP", "target": "1.2.3.4"},
        )
        state = _make_state(messages=[msg], is_authorized=False)
        result = await agent.run_cycle(state)
        obs = result["agent_observations"][-1]
        assert obs.tools_used == []

    @pytest.mark.asyncio
    async def test_response_run_cycle_authorized(self):
        agent = ResponseAgent()
        msg = _make_message(
            msg_type=MessageType.COMMAND,
            payload={"action": "BLOCK_IP", "target": "1.2.3.4"},
        )
        state = _make_state(messages=[msg], is_authorized=True)
        result = await agent.run_cycle(state)
        obs = result["agent_observations"][-1]
        assert obs.action_taken == "remediation_executed"
