"""Threat intelligence routes."""

from fastapi import Depends, HTTPException, status

from src.asoc.core.auth import require_jwt
from src.asoc.core.config import settings
from src.asoc.core.logging import get_logger

from . import router

logger = get_logger("asoc.routes.threat_intel")


@router.get("/threat-intel/indicators", dependencies=[Depends(require_jwt)])
async def list_threat_indicators():
    from src.asoc.core.db_queries import get_threat_indicators

    try:
        return await get_threat_indicators()
    except Exception as e:
        logger.error("list_threat_indicators_failed", error=str(e))
        if settings.ENVIRONMENT == "production":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Threat intelligence database temporarily unavailable",
            )
        return {
            "indicators": [
                {
                    "id": "IOC-001",
                    "type": "SHA256",
                    "value": "e3b0c44298fc1c149afbf4c8996fb924",
                    "severity": "critical",
                    "confidence": 0.98,
                    "source": "VirusTotal",
                    "tlp": "RED",
                    "tags": ["ransomware"],
                },
            ],
            "count": 1,
        }
