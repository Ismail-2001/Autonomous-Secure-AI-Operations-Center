"""SIEM & EDR Enterprise Ingestion API routes.

Provides direct webhook and event collector ingestion endpoints for:
- Splunk HTTP Event Collector (HEC)
- Microsoft Sentinel Incident / Alert Webhooks
- CrowdStrike Falcon Detection Webhooks
- Generic SIEM / Syslog Forwarders
"""

import json
from typing import Any, Dict, List, Optional, Union

from fastapi import Header, HTTPException, Request, Response, status
from pydantic import BaseModel

from src.asoc.audit.audit_trail import log_agent_action
from src.asoc.core.config import settings
from src.asoc.core.job_service import get_job_service
from src.asoc.core.logging import get_logger
from src.asoc.core.siem_normalizer import NormalizedSecurityAlert, SiemNormalizer

from . import get_event_store, router

logger = get_logger("asoc.integrations")


async def _process_and_dispatch_alert(alert: NormalizedSecurityAlert) -> Dict[str, Any]:
    """Store normalized alert, broadcast to WebSocket/Redis, and trigger autonomous investigation if high risk."""
    store = get_event_store()

    # 1. Log to immutable event store
    log_agent_action(
        agent_id=f"SIEM_{alert.source_system.upper()}",
        action=f"INGEST_{alert.event_type.upper()}",
        payload={
            "event_id": alert.event_id,
            "title": alert.title,
            "severity": alert.severity,
            "source_ip": alert.source_ip,
            "target_host": alert.target_host,
            "user": alert.user,
            "mitre_techniques": alert.mitre_techniques,
        },
    )

    # 2. Broadcast to connected WebSocket / Redis PubSub clients
    try:
        from src.asoc.api.app import manager

        await manager.broadcast({
            "type": "SIEM_ALERT_INGESTED",
            "source": alert.source_system,
            "event_id": alert.event_id,
            "title": alert.title,
            "severity": alert.severity,
            "target_host": alert.target_host,
            "mitre_techniques": alert.mitre_techniques,
        })
    except Exception:
        pass

    # 3. Autonomous Incident Trigger: If High/Critical, enqueue investigation job
    job_id = None
    if alert.is_actionable():
        service = get_job_service()
        job = await service.enqueue_job(
            incident_id=f"INC-{alert.event_id}",
            max_attempts=3,
            state_payload={
                "source_system": alert.source_system,
                "event_type": alert.event_type,
                "severity": alert.severity,
                "title": alert.title,
                "target_host": alert.target_host,
                "source_ip": alert.source_ip,
                "destination_ip": alert.destination_ip,
                "user": alert.user,
                "process": alert.process,
                "command_line": alert.command_line,
                "mitre_tactics": alert.mitre_tactics,
                "mitre_techniques": alert.mitre_techniques,
            },
        )
        job_id = job.id
        logger.info(
            "siem_alert_escalated_to_autonomous_investigation",
            event_id=alert.event_id,
            job_id=job_id,
            severity=alert.severity,
        )

    return {
        "event_id": alert.event_id,
        "status": "ingested",
        "actionable": alert.is_actionable(),
        "investigation_job_id": job_id,
    }


def _verify_token(provided_token: Optional[str], expected_secret: Optional[Any], name: str) -> None:
    """Validate incoming webhook token if configured in production."""
    if expected_secret is None:
        return  # In dev / unconfigured mode, allow incoming telemetry
    expected = expected_secret.get_secret_value() if hasattr(expected_secret, "get_secret_value") else str(expected_secret)
    if not provided_token or provided_token.strip() != expected.strip():
        logger.warning("siem_ingest_token_rejected", integration=name)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or missing {name} authorization token",
        )


# ── 1. Splunk HTTP Event Collector (HEC) ──────────────────────────────────


@router.post("/integrations/splunk/hec", status_code=status.HTTP_200_OK)
async def ingest_splunk_hec(
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """Splunk HTTP Event Collector (HEC) compliant ingestion endpoint."""
    token = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() in ("splunk", "bearer"):
            token = parts[1]

    _verify_token(token, settings.SPLUNK_HEC_TOKEN or settings.SIEM_INGESTION_TOKEN, "Splunk HEC")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")

    # Splunk HEC supports both single event JSON and batches
    if isinstance(body, list):
        results = []
        for item in body:
            alert = SiemNormalizer.normalize_splunk_hec(item)
            res = await _process_and_dispatch_alert(alert)
            results.append(res)
        return {"text": "Success", "code": 0, "ackId": 1, "processed_count": len(results)}
    else:
        alert = SiemNormalizer.normalize_splunk_hec(body)
        res = await _process_and_dispatch_alert(alert)
        return {"text": "Success", "code": 0, "ackId": 1, "details": res}


# ── 2. Microsoft Sentinel / Azure Monitor Webhook ─────────────────────────


@router.post("/integrations/sentinel/webhook", status_code=status.HTTP_202_ACCEPTED)
async def ingest_sentinel_webhook(
    request: Request,
    x_sentinel_token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
):
    """Microsoft Sentinel incident and alert webhook receiver."""
    token = x_sentinel_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")

    _verify_token(token, settings.SENTINEL_WEBHOOK_SECRET or settings.SIEM_INGESTION_TOKEN, "Microsoft Sentinel")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")

    alert = SiemNormalizer.normalize_sentinel_alert(body)
    res = await _process_and_dispatch_alert(alert)
    return {"status": "accepted", "source": "sentinel", "data": res}


# ── 3. CrowdStrike Falcon Detection Webhook ───────────────────────────────


@router.post("/integrations/crowdstrike/webhook", status_code=status.HTTP_202_ACCEPTED)
async def ingest_crowdstrike_webhook(
    request: Request,
    x_crowdstrike_secret: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
):
    """CrowdStrike Falcon detection notification webhook receiver."""
    token = x_crowdstrike_secret
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")

    _verify_token(token, settings.CROWDSTRIKE_WEBHOOK_SECRET or settings.SIEM_INGESTION_TOKEN, "CrowdStrike")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")

    alert = SiemNormalizer.normalize_crowdstrike_detection(body)
    res = await _process_and_dispatch_alert(alert)
    return {"status": "accepted", "source": "crowdstrike", "data": res}


# ── 4. Generic Universal SIEM Webhook ─────────────────────────────────────


@router.post("/integrations/generic/webhook", status_code=status.HTTP_202_ACCEPTED)
async def ingest_generic_webhook(
    request: Request,
    authorization: Optional[str] = Header(None),
):
    """Universal SIEM webhook receiver for Datadog, Elastic, QRadar, and custom forwarders."""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")

    _verify_token(token, settings.SIEM_INGESTION_TOKEN, "Generic SIEM")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")

    alert = SiemNormalizer.normalize_generic_webhook(body)
    res = await _process_and_dispatch_alert(alert)
    return {"status": "accepted", "source": "generic_siem", "data": res}
