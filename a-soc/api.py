import asyncio
import os
import random
import sys
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel, Field

sys.path.append(str(Path(__file__).parent))

from agents.base.message import ASOCMessage, MessageType, Priority
from agents.notifications.notification_agent import NotificationAgent
from core.auth import require_api_token, require_ws_token
from core.circuit_breaker import CircuitBreaker
from core.database import PostgresEventStore, close_db_pool, get_db_pool
from core.logging import get_logger, get_request_id, set_incident_id, set_request_id, set_trace_id
from core.message_bus import close_message_bus, get_message_bus
from core.rate_limiter import check_rate_limit

logger = get_logger("asoc.api")

notification_agent = NotificationAgent()

# Use PostgresEventStore if DATABASE_URL is configured, otherwise JSONL EventStore
_db_url = os.getenv("DATABASE_URL", "")
if _db_url and "localhost" not in _db_url:
    event_store = PostgresEventStore()
else:
    from core.memory.event_store import EventStore as _fallback_store

    event_store = _fallback_store()

CORS_ALLOW_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
WS_API_TOKEN = os.getenv("WS_API_TOKEN", "dev-token")


# ── Pydantic Input Validation ──


class SimulationStart(BaseModel):
    scenario: Optional[str] = Field(None, max_length=100)


class ApprovalAction(BaseModel):
    incident_id: str = Field(..., min_length=1, max_length=64)
    approved: bool = True


class HuntingQuery(BaseModel):
    q: str = Field(default="", max_length=500)
    source: str = Field(default="", max_length=100)
    event_type: str = Field(default="", max_length=50)
    start_time: str = Field(default="", max_length=30)
    end_time: str = Field(default="", max_length=30)
    limit: int = Field(default=50, ge=1, le=500)
    offset: int = Field(default=0, ge=0)


# ── Connection Manager (thread-safe with heartbeat) ──


class ConnectionManager:
    def __init__(self, ping_interval: int = 30):
        self._connections: List[WebSocket] = []
        self._lock = asyncio.Lock()
        self._ping_interval = ping_interval
        self._reaper_task: Optional[asyncio.Task] = None

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.append(websocket)
        if self._reaper_task is None:
            self._reaper_task = asyncio.create_task(self._reap_stale())

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            try:
                self._connections.remove(websocket)
            except ValueError:
                pass

    async def broadcast(self, message: dict) -> None:
        async with self._lock:
            dead: List[WebSocket] = []
            for conn in self._connections:
                try:
                    await conn.send_json(message)
                except Exception:
                    dead.append(conn)
            for conn in dead:
                try:
                    self._connections.remove(conn)
                except ValueError:
                    pass

    async def _reap_stale(self) -> None:
        while True:
            await asyncio.sleep(self._ping_interval)
            dead: List[WebSocket] = []
            async with self._lock:
                for conn in self._connections:
                    try:
                        await conn.send_json({"type": "PING"})
                    except Exception:
                        dead.append(conn)
                for conn in dead:
                    try:
                        self._connections.remove(conn)
                    except ValueError:
                        pass
            if not self._connections:
                self._reaper_task = None
                break


manager = ConnectionManager()
instrumentator = Instrumentator()


# ── Lifespan ──


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("app_starting")
    instrumentator.instrument(app).expose(app)
    # Run Alembic migration on startup if Postgres is configured
    if isinstance(event_store, PostgresEventStore):
        try:
            import subprocess

            result = subprocess.run(
                [sys.executable, "-m", "alembic", "upgrade", "head"],
                capture_output=True,
                text=True,
                cwd=str(Path(__file__).parent),
                timeout=30,
            )
            if result.returncode == 0:
                logger.info("alembic_migration_complete", output=result.stdout.strip())
            else:
                logger.error("alembic_migration_failed", stderr=result.stderr.strip())
        except Exception as e:
            logger.error("alembic_migration_error", error=str(e))
    bg = asyncio.create_task(background_telemetry())
    yield
    bg.cancel()
    await close_db_pool()
    await close_message_bus()
    logger.info("app_stopped")


app = FastAPI(title="A-SOC API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Request ID Middleware ──


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    rid = request.headers.get("X-Request-ID", "")
    set_request_id(rid)
    set_trace_id()
    response = await call_next(request)
    response.headers["X-Request-ID"] = get_request_id()
    return response


# ── Global Exception Handlers ──


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "status_code": exc.status_code, "request_id": get_request_id()},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error("unhandled_exception", error=str(exc))
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "status_code": 500, "request_id": get_request_id()},
    )


# ── Circuit Breakers ──
db_circuit_breaker = CircuitBreaker("postgres", failure_threshold=3, recovery_timeout=15.0)
redis_circuit_breaker = CircuitBreaker("redis", failure_threshold=3, recovery_timeout=15.0)


# ── Health ──


@app.get("/health")
async def health_check():
    """Aggregated health check — no auth required (for load balancers)."""
    db_ok = False
    bus_ok = False
    vector_ok = False

    try:
        if isinstance(event_store, PostgresEventStore):
            pool = await get_db_pool()
            async with pool.pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            db_ok = True
        else:
            db_ok = True
    except Exception:
        pass

    try:
        bus = await get_message_bus()
        bus_ok = await bus.health_check()
    except Exception:
        pass

    try:
        from core.vector.pinecone_provider import vector_provider

        vector_ok = await vector_provider.health_check()
    except Exception:
        pass

    db_status = "connected" if db_ok else "unavailable"
    bus_status = "connected" if bus_ok else "unavailable"
    vector_status = "connected" if vector_ok else "unavailable"
    overall = "healthy" if (db_ok and bus_ok and vector_ok) else "degraded"
    # If using JSONL store, DB connectivity is not applicable
    if not isinstance(event_store, PostgresEventStore):
        db_status = "not_applicable"
        overall = "healthy" if (bus_ok or vector_ok) else "degraded"
    if not bus_ok and isinstance(event_store, PostgresEventStore):
        bus_status = "unavailable"
    return {
        "status": overall,
        "service": "asoc-backend",
        "version": "0.1.0",
        "active_connections": len(manager._connections),
        "database": db_status,
        "message_bus": bus_status,
        "vector_store": vector_status,
        "circuit_breakers": {
            "postgres": db_circuit_breaker.state.value,
            "redis": redis_circuit_breaker.state.value,
        },
    }


# ── Threat Hunting API ──


@app.get("/api/hunting/events", dependencies=[Depends(require_api_token), Depends(check_rate_limit)])
async def hunting_events(
    q: str = Query(default="", max_length=500),
    source: str = Query(default="", max_length=100, alias="agent"),
    event_type: str = Query(default="", max_length=50),
    start_time: str = Query(default="", max_length=30),
    end_time: str = Query(default="", max_length=30),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    result = await event_store.search_events(
        query=q,
        agent=source,
        event_type=event_type,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
        offset=offset,
    )
    return {"status": "ok", **result}


@app.get("/api/hunting/timeline", dependencies=[Depends(require_api_token), Depends(check_rate_limit)])
async def hunting_timeline(
    q: str = Query(default="", max_length=500),
    source: str = Query(default="", max_length=100, alias="agent"),
    start_time: str = Query(default="", max_length=30),
    end_time: str = Query(default="", max_length=30),
    bucket: str = Query(default="hour", pattern="^(minute|hour|day)$"),
):
    buckets = await event_store.get_timeline(
        query=q,
        agent=source,
        start_time=start_time,
        end_time=end_time,
        bucket=bucket,
    )
    return {"status": "ok", "buckets": buckets, "bucket_size": bucket}


# ── WebSocket ──


@app.websocket("/ws/threat-feed")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(default="")):
    import hmac

    if not token or not hmac.compare_digest(token, WS_API_TOKEN):
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await manager.connect(websocket)
    permission_event = asyncio.Event()
    client_id = str(id(websocket))
    tid = set_trace_id()
    current_task: Optional[asyncio.Task] = None

    try:
        while True:
            data = await websocket.receive_text()

            if data == "PONG":
                continue

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
        await manager.disconnect(websocket)
        if current_task:
            current_task.cancel()


# ── Background Telemetry ──


async def background_telemetry():
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


# ── Simulation ──


async def run_simulation(permission_event: asyncio.Event):
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
    set_incident_id(incident_id)

    await stream_status("System", "monitoring", f"Scenario Active: {scenario['name']}", "low")
    await stream_status("Telemetry", "scanning", f"Ingesting Logs: {scenario['telemetry']}", "low")

    alert_msg = ASOCMessage(
        message_type=MessageType.ALERT,
        source_agent="TelemetryAgent",
        payload=scenario["telemetry"],
        correlation_id=incident_id,
        priority=Priority.MEDIUM,
    )
    await stream_status("Telemetry", "alert", scenario["alert"], "medium")

    # Publish to message bus
    try:
        bus = await get_message_bus()
        await bus.publish("telemetry", {"event": scenario["telemetry"], "incident_id": incident_id})
    except Exception as e:
        logger.error("message_bus_publish_failed", error=str(e))

    # Detection
    await stream_status("Detection", "analyzing", "Correlating events with Threat Intel...", "low")

    from agents.detection.detection_agent import DetectionAgent

    da = DetectionAgent()
    detection_result = await da.analyze_threat(scenario["telemetry"])
    detected_score = detection_result.payload["risk_score"] if detection_result else scenario["risk_score"]

    await stream_status("Detection", "detected", f"Threat Confirmed: Risk Score {detected_score}", "high")

    # Supervisor
    await stream_status("Supervisor", "evaluating", "Checking policy guardrails...", "low")

    if detected_score > 0.6:
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
                "risk_score": detected_score,
            }
        )
        await permission_event.wait()
        await stream_status("Supervisor", "authorized", "Action Authorized. Proceeding...", "low")

    # Forensics
    await stream_status("Forensics", "investigating", "Reconstructing blast radius...", "medium")
    await manager.broadcast({"type": "BLAST_RADIUS_UPDATE", "graph": scenario["graph"], "root_cause": scenario["name"]})
    await stream_status("Forensics", "complete", "Root cause execution trace mapped.", "high")

    # Response
    await stream_status("Response", "actuating", f"Executing {scenario['action']}...", "critical")
    await stream_status("Response", "notifying", "Sending alert via configured notification channels...", "medium")
    await notification_agent.send_alert(
        title=f"A-SOC: {scenario['name']}",
        message=f"Action: {scenario['action']} on {scenario['target']} | Risk Score: {detected_score}",
        severity="critical" if detected_score > 0.8 else "high",
        fields={
            "Incident": incident_id,
            "Action": scenario["action"],
            "Target": scenario["target"],
            "Risk Score": f"{detected_score:.2f}",
        },
    )

    await stream_status("Response", "success", "Threat Neutralized. Infrastructure Secure.", "low")

    # Compliance
    await stream_status("Compliance", "auditing", "Mapping to SOC2 & ISO 27001...", "low")
    await stream_status("Compliance", "logged", f"Audit record #{random.randint(1000, 9999)} sealed.", "low")

    # Persist to event store
    try:
        await event_store.append_event(
            "threat_cycle_complete",
            {"scenario": scenario["name"], "risk_score": detected_score, "action": scenario["action"]},
            "System",
        )
    except Exception as e:
        logger.error("event_store_append_failed", error=str(e))

    logger.info("simulation_complete", scenario=scenario["name"], risk_score=detected_score, incident_id=incident_id)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=9002)
