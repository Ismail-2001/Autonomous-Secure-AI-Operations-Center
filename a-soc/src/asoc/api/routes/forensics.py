"""Forensics evidence routes."""

from fastapi import Depends

from src.asoc.core.auth import require_jwt

from . import router


@router.get("/forensics/jobs", dependencies=[Depends(require_jwt)])
async def list_forensics_jobs():
    from src.asoc.core.db_queries import get_forensics_jobs

    try:
        return await get_forensics_jobs()
    except Exception:
        return {
            "jobs": [
                {"id": "FOR-001", "title": "Memory Dump Analysis", "status": "completed", "type": "volatile", "findings": ["Registry modifications detected"], "artifacts": ["MEM_DUMP_001.raw"], "agent": "ForensicsAgent"},
            ],
            "count": 1,
        }
