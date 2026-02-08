from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import uuid
import sys
from pathlib import Path
from typing import List
from datetime import datetime

# Add the a-soc directory (parent of api.py) to sys.path
sys.path.append(str(Path(__file__).parent))

from agents.telemetry.telemetry_agent import TelemetryAgent
from agents.detection.detection_agent import DetectionAgent
from agents.supervisor.supervisor_agent import SupervisorAgent
from agents.forensics.forensics_agent import ForensicsAgent
from agents.response.response_agent import ResponseAgent
from agents.compliance.compliance_agent import ComplianceAgent
from agents.base.message import ASOCMessage, MessageType, Priority

app = FastAPI(title="A-SOC API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_json(message)

manager = ConnectionManager()

@app.websocket("/ws/threat-feed")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    permission_event = asyncio.Event() # Used to pause execution
    
    try:
        current_task = None
        
        while True:
            # Keep connection alive and listen for commands from UI
            data = await websocket.receive_text()
            
            if data == "START_SIMULATION":
                # Create a new simulation task
                if current_task: current_task.cancel()
                permission_event.clear() # Reset approval status
                current_task = asyncio.create_task(run_simulation(permission_event))
            
            elif data == "APPROVE_ACTION":
                # User clicked 'Approve'
                permission_event.set() 
                await manager.broadcast({
                    "id": str(uuid.uuid4()),
                    "timestamp": datetime.utcnow().isoformat(),
                    "agent": "System",
                    "status": "approved",
                    "message": "Human operator authorized action.",
                    "severity": "low"
                })

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        if current_task: current_task.cancel()

async def run_simulation(permission_event: asyncio.Event):
    """Run the secure SOC cycle and stream updates to the UI, pausing for approval."""
    
    # helper to stream status
    async def stream_status(agent, status, message, severity="low"):
        await manager.broadcast({
            "id": str(uuid.uuid4()),
            "timestamp":  datetime.utcnow().isoformat(),
            "agent": agent,  
            "status": status,
            "message": message,
            "severity": severity
        })
        await asyncio.sleep(1.5) # Pacing for demo

    # 1. Initialize Agents
    telemetry = TelemetryAgent()
    detection = DetectionAgent()
    supervisor = SupervisorAgent()
    forensics = ForensicsAgent()
    response = ResponseAgent()
    compliance = ComplianceAgent()

    await stream_status("System", "active", "A-SOC Protocol Initiated", "low")

    # 2. Ingest
    await stream_status("Telemetry", "scanning", "Ingesting CloudTrail Logs...", "low")
    incident_id = str(uuid.uuid4())
    alert_msg = ASOCMessage(
        message_type=MessageType.ALERT,
        source_agent="TelemetryAgent",
        payload={"event": "ConsoleLogin", "user": "admin", "ip": "1.2.3.4"},
        correlation_id=incident_id,
        priority=Priority.MEDIUM
    )
    await stream_status("Telemetry", "alert", "Suspicious ConsoleLogin detected (IP: 1.2.3.4)", "medium")

    # 3. Detect
    await stream_status("Detection", "analyzing", "Analyzing threat pattern with LLM...", "low")
    detection_report = await detection.process_message(alert_msg)
    if detection_report:
         await stream_status("Detection", "detected", f"Threat Confirmed: Risk Score {detection_report.payload['risk_score']}", "high")

    # 4. Supervise
    await stream_status("Supervisor", "evaluating", "Checking policy guardrails...", "low")
    
    # Simulate high risk decision requiring approval
    # Normally Supervisor.process_message handles this, but for demo we intercept
    risk_score = detection_report.payload['risk_score']
    
    if risk_score > 0.8:
        # PAUSE FOR HUMAN APPROVAL
        await stream_status("Supervisor", "blocked", "High Risk Action Proposed: IAM_REVOKE. Awaiting Authorization...", "critical")
        
        # Send explicit approval request to UI
        await manager.broadcast({
            "type": "APPROVAL_REQUIRED",
            "action": "IAM_REVOKE",
            "target": "admin-user",
            "risk_score": risk_score
        })
        
        # Wait until frontend sends "APPROVE_ACTION" which sets the event
        await permission_event.wait()
        
        await stream_status("Supervisor", "authorized", "Action Authorized. Proceeding...", "low")

    # 5. Forensics
    await stream_status("Forensics", "investigating", "Reconstructing blast radius...", "medium")
    
    # Synthesize a command for forensics (in real flow, this comes from Supervisor)
    forensics_command = ASOCMessage(
        message_type=MessageType.COMMAND,
        source_agent="SupervisorAgent",
        target_agent="ForensicsAgent",
        payload={"action": "investigate", "target": "admin-user"},
        correlation_id=incident_id
    )
    
    forensics_report = await forensics.process_message(forensics_command)
    
    if forensics_report and "blast_radius" in forensics_report.payload:
        graph_data = forensics_report.payload["blast_radius"]
        await manager.broadcast({
            "type": "BLAST_RADIUS_UPDATE",
            "graph": graph_data,
            "root_cause": forensics_report.payload.get("root_cause")
        })

    await stream_status("Forensics", "complete", "Root cause identified: Compromised Creds", "high")

    # 6. Response
    await stream_status("Response", "actuating", "Executing IAM Revocation...", "critical")
    remediation = ASOCMessage(
            message_type=MessageType.COMMAND,
            source_agent="SupervisorAgent",
            target_agent="ResponseAgent",
            payload={"action": "IAM_REVOKE", "target": "admin-user"},
            correlation_id=incident_id
    )
    await response.process_message(remediation)
    await stream_status("Response", "success", "Threat Neutralized. IAM User Revoked.", "low")

    # 7. Compliance
    await stream_status("Compliance", "auditing", "Mapping to SOC2 & ISO 27001...", "low")
    log = ASOCMessage(
        message_type=MessageType.LOG,
        source_agent="ResponseAgent",
            payload={"event_type": "revoked_access", "details": {"user": "admin-user"}},
            correlation_id=incident_id
    )
    await compliance.process_message(log)
    await stream_status("Compliance", "logged", "Audit record #8921 sealed.", "low")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
