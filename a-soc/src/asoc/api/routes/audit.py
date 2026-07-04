"""Audit trail routes."""

from typing import Optional

from fastapi import Depends, Query

from src.asoc.audit.audit_trail import get_audit_trail
from src.asoc.core.auth import require_role, Role

from . import router


@router.get("/audit/verify", dependencies=[Depends(require_role(Role.SUPERVISOR))])
async def verify_audit_chain():
    trail = get_audit_trail()
    result = trail.verify_chain()
    return result.model_dump()


@router.get("/audit/entries", dependencies=[Depends(require_role(Role.ANALYST))])
async def list_audit_entries(
    agent_id: Optional[str] = Query(None, max_length=64),
    action: Optional[str] = Query(None, max_length=64),
    limit: int = Query(100, ge=1, le=1000),
):
    trail = get_audit_trail()
    entries = trail.get_entries(agent_id=agent_id, action=action, limit=limit)
    return {"entries": [e.model_dump() for e in entries], "count": len(entries)}


@router.get("/rate-limits", dependencies=[Depends(require_role(Role.ADMIN))])
async def rate_limit_stats():
    from src.asoc.middleware.rate_limiter import get_agent_rate_limiter
    limiter = get_agent_rate_limiter()
    return limiter.get_stats()
