import pytest
from agents.base.message import ASOCMessage, MessageType, Priority
from agents.detection.detection_agent import DetectionAgent
from agents.response.response_agent import ResponseAgent
from agents.compliance.compliance_agent import ComplianceAgent
from agents.supervisor.supervisor_agent import SupervisorAgent

@pytest.mark.asyncio
async def test_detection_agent_processes_telemetry_alert():
    agent = DetectionAgent()
    msg = ASOCMessage(
        message_type=MessageType.ALERT,
        source_agent="TelemetryAgent",
        payload={"event": {"eventName": "ConsoleLogin", "sourceIPAddress": "1.2.3.4"}},
        priority=Priority.MEDIUM
    )
    result = await agent.process_message(msg)
    assert result is not None
    assert result.message_type == MessageType.ALERT
    assert "risk_score" in result.payload

@pytest.mark.asyncio
async def test_detection_agent_ignores_non_telemetry():
    agent = DetectionAgent()
    msg = ASOCMessage(
        message_type=MessageType.COMMAND,
        source_agent="SupervisorAgent",
        payload={}
    )
    result = await agent.process_message(msg)
    assert result is None

@pytest.mark.asyncio
async def test_supervisor_routes_to_forensics():
    agent = SupervisorAgent()
    msg = ASOCMessage(
        message_type=MessageType.ALERT,
        source_agent="DetectionAgent",
        payload={"risk_score": 0.85, "reasoning": "Suspicious login"},
        correlation_id="test-123"
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
        payload={"action": "IAM_REVOKE", "target": "admin-user"}
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
        payload={"event_type": "revoked_access", "details": {"user": "admin"}}
    )
    result = await agent.process_message(msg)
    assert result is None
