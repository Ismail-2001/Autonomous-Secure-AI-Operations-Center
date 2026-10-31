"""Asset inventory routes."""

from fastapi import Depends, HTTPException, Query, status

from src.asoc.core.auth import require_jwt
from src.asoc.core.config import settings
from src.asoc.core.logging import get_logger

from . import router

logger = get_logger("asoc.routes.assets")


@router.get("/assets", dependencies=[Depends(require_jwt)])
async def list_assets(limit: int = Query(50, ge=1, le=500)):
    from src.asoc.core.db_queries import get_assets

    try:
        return await get_assets(limit=limit)
    except Exception as e:
        logger.error("list_assets_failed", error=str(e))
        if settings.ENVIRONMENT == "production":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service temporarily unavailable for asset retrieval",
            )
        return {
            "assets": [
                {
                    "id": "AST-001",
                    "name": "SRV-PROD-DB-01",
                    "type": "server",
                    "ip_address": "10.0.4.122",
                    "os": "LINUX_DEBIAN",
                    "status": "online",
                    "risk_score": 72,
                    "vulnerabilities": 5,
                    "owner": "SEC_OPS_A",
                },
            ],
            "count": 1,
        }
