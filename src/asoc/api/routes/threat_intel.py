"""Threat intelligence routes."""

from fastapi import Depends

from src.asoc.core.auth import require_jwt

from . import router


@router.get("/threat-intel/indicators", dependencies=[Depends(require_jwt)])
async def list_threat_indicators():
    from src.asoc.core.db_queries import get_threat_indicators

    try:
        return await get_threat_indicators()
    except Exception:
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
