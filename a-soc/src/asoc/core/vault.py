import os
from functools import lru_cache
from typing import Optional

from src.asoc.core.config import settings
from src.asoc.core.logging import get_logger

logger = get_logger("asoc.vault")


class VaultProvider:
    def __init__(self, addr: str = ""):
        self._addr = addr or os.getenv("VAULT_ADDR", "")
        self._client = None
        self._enabled = bool(self._addr)

    async def get_secret(self, path: str, key: str) -> Optional[str]:
        if not self._enabled:
            logger.warning("vault_not_configured", path=path)
            return None
        try:
            import hvac
            token = os.getenv("VAULT_TOKEN", "")
            if not self._client:
                self._client = hvac.Client(url=self._addr, token=token)
            secret = self._client.secrets.kv.v2.read_secret_version(path=path)
            return secret.get("data", {}).get("data", {}).get(key)
        except ImportError:
            logger.error("vault_hvac_not_installed")
            return None
        except Exception as e:
            logger.error("vault_read_failed", path=path, error=str(e))
            return None

    async def health_check(self) -> bool:
        if not self._enabled:
            return False
        try:
            import hvac
            token = os.getenv("VAULT_TOKEN", "")
            client = hvac.Client(url=self._addr, token=token)
            return client.is_authenticated()
        except Exception:
            return False


vault = VaultProvider()
