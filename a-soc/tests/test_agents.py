import pytest

from agents.base.message import ASOCMessage, MessageType, Priority
from agents.compliance.compliance_agent import ComplianceAgent
from agents.detection.detection_agent import DetectionAgent
from agents.response.response_agent import ResponseAgent
from agents.supervisor.supervisor_agent import SupervisorAgent


@pytest.mark.asyncio
async def test_detection_agent_processes_telemetry_alert():
    agent = DetectionAgent()
    msg = ASOCMessage(
        message_type=MessageType.ALERT,
        source_agent="TelemetryAgent",
        payload={"event": {"eventName": "ConsoleLogin", "sourceIPAddress": "1.2.3.4"}},
        priority=Priority.MEDIUM,
    )
    result = await agent.process_message(msg)
    assert result is not None
    assert result.message_type == MessageType.ALERT
    assert "risk_score" in result.payload


@pytest.mark.asyncio
async def test_detection_agent_ignores_non_telemetry():
    agent = DetectionAgent()
    msg = ASOCMessage(message_type=MessageType.COMMAND, source_agent="SupervisorAgent", payload={})
    result = await agent.process_message(msg)
    assert result is None


@pytest.mark.asyncio
async def test_detection_agent_with_custom_provider():
    from unittest.mock import AsyncMock

    from core.llm.providers import LLMResult

    mock_provider = AsyncMock()
    mock_provider.name = "test:mock"
    mock_provider.analyze.return_value = LLMResult(
        threat_detected=True,
        risk_score=0.65,
        reasoning="Custom provider analysis",
        attack_technique="T1078",
    )
    agent = DetectionAgent(provider=mock_provider)
    msg = ASOCMessage(
        message_type=MessageType.ALERT,
        source_agent="TelemetryAgent",
        payload={"event": {"eventName": "ConsoleLogin"}},
        priority=Priority.MEDIUM,
    )
    result = await agent.process_message(msg)
    assert result is not None
    assert result.payload["risk_score"] == 0.65
    assert result.payload["attack_technique"] == "T1078"
    mock_provider.analyze.assert_called_once()


@pytest.mark.asyncio
async def test_detection_agent_provider_failure_falls_back_to_mock():
    from unittest.mock import AsyncMock

    mock_provider = AsyncMock()
    mock_provider.name = "test:fail"
    mock_provider.analyze.side_effect = Exception("API unavailable")
    agent = DetectionAgent(provider=mock_provider)
    msg = ASOCMessage(
        message_type=MessageType.ALERT,
        source_agent="TelemetryAgent",
        payload={"event": {"eventName": "ConsoleLogin"}},
        priority=Priority.MEDIUM,
    )
    result = await agent.process_message(msg)
    assert result is not None
    assert result.payload["risk_score"] == 0.85
    assert result.payload["reasoning"] == "Suspicious ConsoleLogin from unusual IP address (1.2.3.4)"


@pytest.mark.asyncio
async def test_supervisor_routes_to_forensics():
    agent = SupervisorAgent()
    msg = ASOCMessage(
        message_type=MessageType.ALERT,
        source_agent="DetectionAgent",
        payload={"risk_score": 0.85, "reasoning": "Suspicious login"},
        correlation_id="test-123",
    )
    result = await agent.process_message(msg)
    assert result is not None
    assert result.target_agent == "ForensicsAgent"
    assert result.correlation_id == "test-123"


@pytest.mark.asyncio
async def test_response_executes_remediation():
    agent = ResponseAgent()
    msg = ASOCMessage(
        message_type=MessageType.COMMAND,
        source_agent="SupervisorAgent",
        target_agent="ResponseAgent",
        payload={"action": "IAM_REVOKE", "target": "admin-user"},
    )
    result = await agent.process_message(msg)
    assert result is not None
    assert result.payload["success"] is True


@pytest.mark.asyncio
async def test_compliance_agent_maps_controls():
    agent = ComplianceAgent()
    msg = ASOCMessage(
        message_type=MessageType.LOG,
        source_agent="ResponseAgent",
        payload={"event_type": "revoked_access", "details": {"user": "admin"}},
    )
    result = await agent.process_message(msg)
    assert result is None


@pytest.mark.asyncio
async def test_telemetry_agent_poll_cloudtrail_returns_messages():
    from unittest.mock import AsyncMock

    from agents.telemetry.telemetry_agent import TelemetryAgent

    mock_provider = AsyncMock()
    mock_provider.fetch_events.return_value = []
    agent = TelemetryAgent(provider=mock_provider)

    result = await agent.poll_cloudtrail()
    assert result is None


@pytest.mark.asyncio
async def test_telemetry_agent_process_command_starts_polling():
    from unittest.mock import AsyncMock

    from agents.telemetry.telemetry_agent import TelemetryAgent

    mock_provider = AsyncMock()
    agent = TelemetryAgent(provider=mock_provider)

    msg = ASOCMessage(message_type=MessageType.COMMAND, source_agent="System", payload={"action": "start_polling"})
    result = await agent.process_message(msg)
    assert result is None


@pytest.mark.asyncio
async def test_telemetry_agent_poll_with_events():
    from unittest.mock import AsyncMock

    from agents.telemetry.cloud_providers import CloudEvent
    from agents.telemetry.telemetry_agent import TelemetryAgent

    mock_event = CloudEvent(
        event_id="test-evt-1",
        event_name="ConsoleLogin",
        event_time="2026-06-05T12:00:00Z",
        source_ip="1.2.3.4",
        user_identity={"type": "IAMUser", "userName": "admin"},
        resources=[],
        raw={},
    )

    mock_provider = AsyncMock()
    mock_provider.fetch_events.return_value = [mock_event]
    agent = TelemetryAgent(provider=mock_provider)

    result = await agent.poll_cloudtrail()
    assert result is not None
    assert result.message_type == MessageType.ALERT
    assert len(result.payload["events"]) == 1
    assert result.payload["events"][0]["eventID"] == "test-evt-1"


@pytest.mark.asyncio
async def test_telemetry_agent_poll_error_handled():
    from unittest.mock import AsyncMock

    from agents.telemetry.telemetry_agent import TelemetryAgent

    mock_provider = AsyncMock()
    mock_provider.fetch_events.side_effect = Exception("API failure")
    agent = TelemetryAgent(provider=mock_provider)

    result = await agent.poll_cloudtrail()
    assert result is None


# ── ForensicsAgent Tests ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_forensics_analyze_incident_returns_reconstruction():
    from agents.forensics.forensics_agent import ForensicsAgent

    agent = ForensicsAgent()
    result = await agent.analyze_incident({"incident_id": "inc-001"})
    assert "root_cause" in result
    assert "blast_radius" in result
    assert "timeline" in result
    assert result["confidence_score"] == 0.92


@pytest.mark.asyncio
async def test_forensics_process_message_returns_report():
    from agents.forensics.forensics_agent import ForensicsAgent

    agent = ForensicsAgent()
    msg = ASOCMessage(
        message_type=MessageType.ALERT,
        source_agent="SupervisorAgent",
        payload={"target": "admin-user", "data": {"risk_score": 0.85}},
        correlation_id="inc-002",
    )
    result = await agent.process_message(msg)
    assert result is not None
    assert result.message_type == MessageType.REPORT
    assert result.target_agent == "SupervisorAgent"
    assert result.correlation_id == "inc-002"
    assert "blast_radius" in result.payload
    assert "root_cause" in result.payload


@pytest.mark.asyncio
async def test_forensics_analyze_incident_with_empty_data():
    from agents.forensics.forensics_agent import ForensicsAgent

    agent = ForensicsAgent()
    result = await agent.analyze_incident({})
    assert result["root_cause"] is not None
    assert len(result["timeline"]) == 3


# ── SupervisorAgent Tests ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_supervisor_evaluate_action_allowed_low_risk():
    from agents.supervisor.supervisor_agent import SupervisorAgent

    agent = SupervisorAgent()
    result = await agent.evaluate_action("DetectionAgent", {"type": "LOG_QUERY"}, 0.1)
    assert result is True


@pytest.mark.asyncio
async def test_supervisor_evaluate_action_blocked_high_risk_destructive():
    from agents.supervisor.supervisor_agent import SupervisorAgent

    agent = SupervisorAgent()
    result = await agent.evaluate_action("ResponseAgent", {"type": "TERMINATE_INSTANCE", "is_destructive": True}, 0.85)
    assert result is False


@pytest.mark.asyncio
async def test_supervisor_evaluate_action_allowed_high_risk_non_destructive():
    from agents.supervisor.supervisor_agent import SupervisorAgent

    agent = SupervisorAgent()
    result = await agent.evaluate_action("ResponseAgent", {"type": "BLOCK_IP", "is_destructive": False}, 0.85)
    assert result is True


@pytest.mark.asyncio
async def test_supervisor_process_message_non_alert_returns_none():
    from agents.supervisor.supervisor_agent import SupervisorAgent

    agent = SupervisorAgent()
    msg = ASOCMessage(
        message_type=MessageType.LOG,
        source_agent="ComplianceAgent",
        payload={"event": "test"},
    )
    result = await agent.process_message(msg)
    assert result is None


@pytest.mark.asyncio
async def test_supervisor_process_message_alert_routes_to_forensics():
    from agents.supervisor.supervisor_agent import SupervisorAgent

    agent = SupervisorAgent()
    msg = ASOCMessage(
        message_type=MessageType.ALERT,
        source_agent="DetectionAgent",
        payload={"risk_score": 0.85, "reasoning": "Detected threat"},
        correlation_id="inc-003",
    )
    result = await agent.process_message(msg)
    assert result is not None
    assert result.target_agent == "ForensicsAgent"
    assert result.correlation_id == "inc-003"
    assert "incident_id" in result.payload


@pytest.mark.asyncio
async def test_supervisor_active_incidents_tracked():
    from agents.supervisor.supervisor_agent import SupervisorAgent

    agent = SupervisorAgent()
    msg = ASOCMessage(
        message_type=MessageType.ALERT,
        source_agent="DetectionAgent",
        payload={"risk_score": 0.75},
        correlation_id="inc-004",
    )
    await agent.process_message(msg)
    assert "inc-004" in agent.active_incidents
    assert agent.active_incidents["inc-004"]["risk_score"] == 0.75
