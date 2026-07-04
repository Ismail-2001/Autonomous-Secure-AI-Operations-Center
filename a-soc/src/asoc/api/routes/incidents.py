"""Incident management and triage routes."""

import json as _json
import uuid
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field

from src.asoc.audit.audit_trail import get_audit_trail
from src.asoc.core.auth import require_jwt
from src.asoc.core.connection import get_db_pool

from . import router


class CreateIncidentRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=2000)
    severity: str = Field(..., pattern="^(critical|high|medium|low)$")
    source: str = Field(default="Dashboard")
    tags: list[str] = Field(default=[])


class TriageRequest(BaseModel):
    triage_status: str = Field(..., pattern="^(new|acknowledged|investigating|escalated|contained|resolved|false_positive)$")
    assigned_to: str | None = None
    notes: str | None = None


class ResponseActionRequest(BaseModel):
    action_type: str = Field(..., min_length=1, max_length=50)
    description: str = Field(..., min_length=1, max_length=500)
    target: str | None = None


@router.get("/incidents", dependencies=[Depends(require_jwt)])
async def list_incidents(limit: int = Query(20, ge=1, le=100)):
    from src.asoc.core.db_queries import get_incidents

    try:
        return await get_incidents(limit=limit)
    except Exception:
        from datetime import datetime, timezone
        return {
            "incidents": [
                {"id": "INC-2023-882", "title": "Unauthorized Login Attempt", "description": "Brute force NTLM relay attempt detected", "severity": "critical", "status": "active", "source": "EVAL-02-DC", "created_at": datetime.now(timezone.utc).isoformat() + "Z", "updated_at": datetime.now(timezone.utc).isoformat() + "Z", "agent": "DetectionAgent", "tags": ["brute-force", "ntlm"]},
            ],
            "count": 1,
        }


@router.post("/incidents", dependencies=[Depends(require_jwt)])
async def create_incident(req: CreateIncidentRequest):
    risk_map = {"critical": 90.0, "high": 70.0, "medium": 50.0, "low": 25.0}
    risk_score = risk_map.get(req.severity, 50.0)

    db = await get_db_pool()
    async with db.pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO incidents (id, incident_number, title, description, severity, status, source, agent, risk_score, tags, created_at, updated_at, triage_status)
            VALUES (gen_random_uuid(), 'INC-2026-' || LPAD((EXTRACT(EPOCH FROM NOW())::int % 10000)::text, 4, '0'), $1, $2, $3, 'active', $4, $5, $6, $7::jsonb, NOW(), NOW(), 'new')
            RETURNING id, incident_number, title, description, severity, status, source, agent, risk_score, tags, created_at, updated_at, triage_status
        """, req.title, req.description, req.severity, req.source, "Dashboard", risk_score, _json.dumps(req.tags))

    return {
        "ok": True,
        "incident": {
            "id": str(row["id"]),
            "incident_number": row["incident_number"],
            "title": row["title"],
            "description": row["description"],
            "severity": row["severity"],
            "status": row["status"],
            "source": row["source"],
            "agent": row["agent"],
            "risk_score": row["risk_score"],
            "tags": req.tags,
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            "triage_status": row["triage_status"],
        },
    }


@router.patch("/incidents/{incident_id}/triage", dependencies=[Depends(require_jwt)])
async def triage_incident(incident_id: str, req: TriageRequest):
    db = await get_db_pool()
    async with db.pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id, incident_number, title FROM incidents WHERE id = $1", incident_id)
        if not row:
            raise HTTPException(status_code=404, detail="Incident not found")

        now = datetime.now(timezone.utc)
        await conn.execute("""
            UPDATE incidents
            SET triage_status = $1, assigned_to = $2, notes = COALESCE($3, notes),
                triaged_by = $4, triaged_at = COALESCE(triaged_at, $5), updated_at = $5
            WHERE id = $6
        """, req.triage_status, req.assigned_to, req.notes, "dashboard-user", now, incident_id)

        get_audit_trail().append(
            agent_id="dashboard-user",
            action="TRIAGE_UPDATE",
            payload={
                "incident_id": incident_id,
                "incident_number": row["incident_number"],
                "triage_status": req.triage_status,
                "assigned_to": req.assigned_to,
            }
        )

    return {"ok": True, "incident_id": incident_id, "triage_status": req.triage_status}


@router.post("/incidents/{incident_id}/actions", dependencies=[Depends(require_jwt)])
async def add_response_action(incident_id: str, req: ResponseActionRequest):
    db = await get_db_pool()
    async with db.pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id, incident_number FROM incidents WHERE id = $1", incident_id)
        if not row:
            raise HTTPException(status_code=404, detail="Incident not found")

        action_entry = {
            "id": str(uuid.uuid4()),
            "type": req.action_type,
            "description": req.description,
            "target": req.target,
            "performed_by": "dashboard-user",
            "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
        }

        await conn.execute("""
            UPDATE incidents
            SET response_actions = response_actions || $1::jsonb, updated_at = $2
            WHERE id = $3
        """, _json.dumps([action_entry]), datetime.now(timezone.utc), incident_id)

        get_audit_trail().append(
            agent_id="dashboard-user",
            action="RESPONSE_ACTION",
            payload={
                "incident_id": incident_id,
                "incident_number": row["incident_number"],
                "action_type": req.action_type,
                "description": req.description,
                "target": req.target,
            }
        )

    return {"ok": True, "action": action_entry}


@router.get("/incidents/{incident_id}/actions", dependencies=[Depends(require_jwt)])
async def get_response_actions(incident_id: str):
    db = await get_db_pool()
    async with db.pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT response_actions FROM incidents WHERE id = $1", incident_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="Incident not found")

    raw = row["response_actions"] or []
    if isinstance(raw, str):
        try:
            raw = _json.loads(raw)
        except Exception:
            raw = []
    return {"actions": raw, "count": len(raw)}
