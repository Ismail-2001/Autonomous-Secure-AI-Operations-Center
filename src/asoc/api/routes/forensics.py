"""Forensics evidence routes."""

from fastapi import Depends, HTTPException, status

from src.asoc.core.auth import require_jwt
from src.asoc.core.config import settings
from src.asoc.core.logging import get_logger

from . import router

logger = get_logger("asoc.routes.forensics")


@router.get("/forensics/jobs", dependencies=[Depends(require_jwt)])
async def list_forensics_jobs():
    from src.asoc.core.db_queries import get_forensics_jobs

    try:
        return await get_forensics_jobs()
    except Exception as e:
        logger.error("list_forensics_jobs_failed", error=str(e))
        if settings.ENVIRONMENT == "production":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Forensics job store temporarily unavailable",
            )
        return {
            "jobs": [
                {
                    "id": "FOR-001",
                    "title": "Memory Dump Analysis",
                    "status": "completed",
                    "type": "volatile",
                    "findings": ["Registry modifications detected"],
                    "artifacts": ["MEM_DUMP_001.raw"],
                    "agent": "ForensicsAgent",
                },
            ],
            "count": 1,
        }
