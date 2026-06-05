import asyncio
import hmac
import os
import random
import sys
import time
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Add the a-soc directory (parent of api.py) to sys.path
sys.path.append(str(Path(__file__).parent))

from agents.base.message import ASOCMessage, MessageType, Priority

# Notification agent for Slack/Teams
from agents.notifications.notification_agent import NotificationAgent

notification_agent = NotificationAgent()


class RateLimiter:
    def __init__(self, max_calls: int = 10, window: float = 10.0):
        self.max_calls = max_calls
        self.window = window
        self.calls: dict[str, list[float]] = defaultdict(list)

    async def check(self, client_id: str) -> bool:
        now = time.monotonic()
        self.calls[client_id] = [t for t in self.calls[client_id] if now - t < self.window]
        if len(self.calls[client_id]) >= self.max_calls:
            return False
        self.calls[client_id].append(now)
        return True


rate_limiter = RateLimiter()


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(background_telemetry())
    yield


app = FastAPI(title="A-SOC API", lifespan=lifespan)

# CORS — driven by env var, default to localhost:3000
CORS_ALLOW_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

WS_API_TOKEN = os.getenv("WS_API_TOKEN", "dev-token")


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


@app.get("/health")
async def health_check():
    """Health check endpoint for Kubernetes probes"""
    return {"status": "healthy", "service": "asoc-backend", "active_connections": len(manager.active_connections)}


@app.websocket("/ws/threat-feed")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(default="")):
    # Authentication
    if not hmac.compare_digest(token, WS_API_TOKEN):
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await manager.connect(websocket)
    permission_event = asyncio.Event()
    client_id = str(id(websocket))

    try:
        current_task = None

        while True:
            # Rate limiting check
            if not await rate_limiter.check(client_id):
                await websocket.send_json({"error": "Rate limit exceeded. Try again later."})
                continue

            data = await websocket.receive_text()

            if data == "START_SIMULATION":
                if current_task:
                    current_task.cancel()
                permission_event.clear()
                current_task = asyncio.create_task(run_simulation(permission_event))

            elif data == "APPROVE_ACTION":
                permission_event.set()
                await manager.broadcast(
                    {
                        "id": str(uuid.uuid4()),
                        "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
                        "agent": "System",
                        "status": "approved",
                        "message": "Human operator authorized action.",
                        "severity": "low",
                    }
                )

            elif data == "STOP_SIMULATION":
                if current_task:
                    current_task.cancel()
                    current_task = None
                await manager.broadcast(
                    {
                        "id": str(uuid.uuid4()),
                        "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
                        "agent": "System",
                        "status": "idle",
                        "message": "Simulation stopped by operator.",
                        "severity": "low",
                    }
                )

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        if current_task:
            current_task.cancel()


async def background_telemetry():
    """Simulate continuous benign log flow."""
    benign_messages = [
        "VPC Flow: Traffic allowed from 10.0.0.5 to 10.0.0.8 (Port 443)",
        "IAM: User 'dev-operator' assumed role 'ReadOnlyAccess'",
        "CloudTrail: GetBucketEncryption on 'assets-prod'",
        "CloudWatch: Metric 'CPUUtilization' within threshold for 'web-server-01'",
        "K8s: Pod 'auth-api-5f8d' healthy heart-beat received",
        "S3: PutObject to 'audit-logs' by 'system-service'",
        "GuardDuty: No new threats detected in last 5 minutes",
        "Config: Resource 'sg-0abc123' compliant with policy 'restricted-ssh'",
    ]
    while True:
        await manager.broadcast(
            {
                "id": str(uuid.uuid4()),
                "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
                "agent": "Telemetry",
                "status": "scanning",
                "message": random.choice(benign_messages),
                "severity": "low",
                "is_background": True,
            }
        )
        await asyncio.sleep(random.uniform(2, 5))


from core.orchestration.workflow import AgentState, create_asoc_graph

asoc_graph = create_asoc_graph()


async def run_simulation(permission_event: asyncio.Event):
    """Run a randomized secure SOC cycle via LangGraph, streaming updates to the UI."""

    async def stream_status(agent, status, message, severity="low"):
        await manager.broadcast(
            {
                "id": str(uuid.uuid4()),
                "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
                "agent": agent,
                "status": status,
                "message": message,
                "severity": severity,
            }
        )
        await asyncio.sleep(1.5)

    await stream_status("System", "active", "A-SOC Protocol Initiated", "low")

    scenarios = [
        {
            "name": "IAM Privilege Escalation",
            "telemetry": {"event": "ConsoleLogin", "user": "admin", "ip": "192.168.1.50"},
            "alert": "Suspicious ConsoleLogin detected (Brute Force)",
            "risk_score": 0.85,
            "action": "IAM_REVOKE",
            "target": "admin-user",
            "graph": {
                "nodes": [
                    {"id": "attacker-ip", "type": "threat_actor", "label": "IP: 192.168.1.50", "risk": "critical"},
                    {"id": "user", "type": "identity", "label": "User: admin", "risk": "high"},
                    {"id": "policy", "type": "resource", "label": "IAM: FullAccess", "risk": "medium"},
                ],
                "edges": [
                    {"source": "attacker-ip", "target": "user", "label": "Brute Force"},
                    {"source": "user", "target": "policy", "label": "Policy Attach"},
                ],
            },
        },
        {
            "name": "Ransomware Data Encrypted",
            "telemetry": {"event": "FileWrite", "path": "/data/db.enc", "process": "encrypt.exe"},
            "alert": "High-velocity file encryption detected on DB Server",
            "risk_score": 0.95,
            "action": "ISOLATE_INSTANCE",
            "target": "i-098f6bcd4621d373c",
            "graph": {
                "nodes": [
                    {"id": "c2-server", "type": "threat_actor", "label": "C2: 45.33.2.1", "risk": "critical"},
                    {"id": "host", "type": "resource", "label": "EC2: DB-Prod", "risk": "critical"},
                    {"id": "file", "type": "resource", "label": "File: sensitive.db", "risk": "high"},
                ],
                "edges": [
                    {"source": "c2-server", "target": "host", "label": "Command & Control"},
                    {"source": "host", "target": "file", "label": "Encryption Process"},
                ],
            },
        },
        {
            "name": "S3 Data Exfiltration",
            "telemetry": {"event": "GetObject", "bucket": "customer-data", "bytes": 5000000000},
            "alert": "Anomalous Data Transfer (5GB) to external IP",
            "risk_score": 0.75,
            "action": "BLOCK_IP",
            "target": "203.0.113.42",
            "graph": {
                "nodes": [
                    {"id": "insider", "type": "identity", "label": "User: analyst-bob", "risk": "medium"},
                    {"id": "bucket", "type": "resource", "label": "S3: customer-data", "risk": "high"},
                    {"id": "dest-ip", "type": "threat_actor", "label": "IP: 203.0.113.42", "risk": "critical"},
                ],
                "edges": [
                    {"source": "insider", "target": "bucket", "label": "Bulk Read"},
                    {"source": "bucket", "target": "dest-ip", "label": "Exfiltration"},
                ],
            },
        },
    ]

    scenario = random.choice(scenarios)
    incident_id = str(uuid.uuid4())

    await stream_status("System", "monitoring", f"Scenario Active: {scenario['name']}", "low")

    # Ingest telemetry
    await stream_status("Telemetry", "scanning", f"Ingesting Logs: {scenario['telemetry']}", "low")

    alert_msg = ASOCMessage(
        message_type=MessageType.ALERT,
        source_agent="TelemetryAgent",
        payload=scenario["telemetry"],
        correlation_id=incident_id,
        priority=Priority.MEDIUM,
    )
    await stream_status("Telemetry", "alert", scenario["alert"], "medium")

    # Run detection through LangGraph
    await stream_status("Detection", "analyzing", "Correlating events with Threat Intel...", "low")

    initial_state: AgentState = {
        "messages": [alert_msg],
        "incident_id": incident_id,
        "risk_score": 0.0,
        "next_step": "telemetry",
        "is_authorized": False,
    }

    try:
        final_state = await asoc_graph.ainvoke(initial_state)
        detected_score = final_state.get("risk_score", scenario["risk_score"])
    except Exception as e:
        print(f"LangGraph execution failed: {e}")
        detected_score = scenario["risk_score"]

    await stream_status("Detection", "detected", f"Threat Confirmed: Risk Score {detected_score}", "high")

    # Supervise (approval gate)
    await stream_status("Supervisor", "evaluating", "Checking policy guardrails...", "low")

    risk_score = detected_score

    if risk_score > 0.6:
        await stream_status(
            "Supervisor",
            "blocked",
            f"High Risk Action Proposed: {scenario['action']}. Awaiting Authorization...",
            "critical",
        )
        await manager.broadcast(
            {
                "type": "APPROVAL_REQUIRED",
                "action": scenario["action"],
                "target": scenario["target"],
                "risk_score": risk_score,
            }
        )
        await permission_event.wait()
        await stream_status("Supervisor", "authorized", "Action Authorized. Proceeding...", "low")

    # Forensics blast radius
    await stream_status("Forensics", "investigating", "Reconstructing blast radius...", "medium")
    await manager.broadcast(
        {
            "type": "BLAST_RADIUS_UPDATE",
            "graph": scenario["graph"],
            "root_cause": scenario["name"],
        }
    )
    await stream_status("Forensics", "complete", "Root cause execution trace mapped.", "high")

    # Response
    await stream_status("Response", "actuating", f"Executing {scenario['action']}...", "critical")
    await stream_status("Response", "notifying", "Sending alert via configured notification channels...", "medium")
    await notification_agent.send_alert(
        title=f"A-SOC: {scenario['name']}",
        message=f"Action: {scenario['action']} on {scenario['target']} | Risk Score: {risk_score}",
        severity="critical" if risk_score > 0.8 else "high",
        fields={
            "Incident": incident_id,
            "Action": scenario["action"],
            "Target": scenario["target"],
            "Risk Score": f"{risk_score:.2f}",
        },
    )
    await asyncio.sleep(0.5)
    await stream_status("Response", "success", "Threat Neutralized. Infrastructure Secure.", "low")

    # Compliance
    await stream_status("Compliance", "auditing", "Mapping to SOC2 & ISO 27001...", "low")
    await stream_status(
        "Compliance",
        "logged",
        f"Audit record #{random.randint(1000, 9999)} sealed.",
        "low",
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=9002)
