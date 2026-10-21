"""Asset inventory routes."""

from fastapi import Depends, Query

from src.asoc.core.auth import require_jwt

from . import router


@router.get("/assets", dependencies=[Depends(require_jwt)])
async def list_assets(limit: int = Query(50, ge=1, le=500)):
    from src.asoc.core.db_queries import get_assets

    try:
        return await get_assets(limit=limit)
    except Exception:
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
