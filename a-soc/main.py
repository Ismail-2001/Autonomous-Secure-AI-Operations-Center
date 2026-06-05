import asyncio
import logging
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from agents.base.message import ASOCMessage, MessageType, Priority
from agents.compliance.compliance_agent import ComplianceAgent
from agents.detection.detection_agent import DetectionAgent
from agents.forensics.forensics_agent import ForensicsAgent
from agents.response.response_agent import ResponseAgent
from agents.supervisor.supervisor_agent import SupervisorAgent
from agents.telemetry.telemetry_agent import TelemetryAgent
from core.logging import get_logger, set_trace_id

logger = get_logger("asoc.main")


async def simulate_threat_cycle():
    trace_id = set_trace_id()
    logger.info("cycle_starting", trace_id=trace_id)

    telemetry = TelemetryAgent()
    detection = DetectionAgent()
    supervisor = SupervisorAgent()
    forensics = ForensicsAgent()
    response = ResponseAgent()
    compliance = ComplianceAgent()

    incident_id = str(uuid.uuid4())

    logger.info("[1] Telemetry: Ingesting AWS CloudTrail logs...")
    alert_msg = ASOCMessage(
        message_type=MessageType.ALERT,
        source_agent="TelemetryAgent",
        payload={"event": "ConsoleLogin", "user": "admin", "ip": "1.2.3.4"},
        correlation_id=incident_id,
        priority=Priority.MEDIUM,
    )

    logger.info("[2] Detection: Analyzing threat with LLM reasoning...")
    detection_report = await detection.process_message(alert_msg)

    if detection_report:
        logger.info("[3] Supervisor: Evaluating risk...", risk_score=detection_report.payload["risk_score"])
        command_to_forensics = await supervisor.process_message(detection_report)

        if command_to_forensics:
            logger.info("[4] Forensics: Reconstructing attack timeline...")
            forensics_report = await forensics.process_message(command_to_forensics)

            logger.info("[5] Response: Executing remediation (IAM_REVOKE)...")
            remediation_cmd = ASOCMessage(
                message_type=MessageType.COMMAND,
                source_agent="SupervisorAgent",
                target_agent="ResponseAgent",
                payload={"action": "IAM_REVOKE", "target": "admin-user"},
                correlation_id=incident_id,
            )
            await response.process_message(remediation_cmd)

            logger.info("[6] Compliance: Mapping incident to SOC2 controls...")
            audit_log = ASOCMessage(
                message_type=MessageType.LOG,
                source_agent="ResponseAgent",
                payload={"event_type": "revoked_access", "details": {"user": "admin-user"}},
                correlation_id=incident_id,
            )
            await compliance.process_message(audit_log)

    logger.info("cycle_complete", trace_id=trace_id)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    asyncio.run(simulate_threat_cycle())
