"""HMAC audit trail with blockchain-style chain verification.

Every agent action produces an AuditEntry that includes:
- SHA-256 hash of the action payload
- HMAC-SHA256 signature with rotating key
- Hash of the previous entry (chain integrity)

verify_chain() proves the entire audit trail has not been tampered with.
This is the SOC 2 / ISO 27001 compliance story.
"""
import hashlib
import hmac
import json
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from pydantic import BaseModel, Field

from src.asoc.core.config import settings
from src.asoc.core.logging import get_logger

logger = get_logger("asoc.audit")


# ── Models ────────────────────────────────────────────────────────────────

class AuditEntry(BaseModel):
    entry_id: str = Field(default_factory=lambda: secrets.token_urlsafe(16))
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    agent_id: str
    action: str
    payload: dict[str, Any] = Field(default_factory=dict)
    payload_hash: str = ""  # SHA-256 of JSON-serialized payload
    previous_hash: str = ""  # Hash of the previous entry (chain link)
    hmac_signature: str = ""  # HMAC-SHA256 of {payload_hash, previous_hash}
    entry_hash: str = ""  # SHA-256 of this full entry (for chaining)


class ChainVerificationResult(BaseModel):
    valid: bool
    total_entries: int
    verified_entries: int
    broken_at: Optional[int] = None
    error: Optional[str] = None


# ── HMAC Key Management ───────────────────────────────────────────────────

def _get_hmac_key() -> bytes:
    """Get HMAC signing key from config. Falls back to WS_API_TOKEN."""
    secret = settings.HMAC_SECRET
    if secret:
        return secret.get_secret_value().encode()
    ws_token = settings.WS_API_TOKEN
    if ws_token:
        return ws_token.get_secret_value().encode()
    logger.warning("no_hmac_key_configured_using_dev_key")
    return b"dev-hmac-key-not-for-production"


def _rotate_key() -> bytes:
    """In production, keys rotate via Vault/KMS. This simulates rotation."""
    base = _get_hmac_key()
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"{base.decode()}:{day}".encode()


# ── Hashing Functions ─────────────────────────────────────────────────────

def hash_payload(payload: dict[str, Any]) -> str:
    """SHA-256 hash of JSON-serialized payload."""
    canonical = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()


def sign_entry(payload_hash: str, previous_hash: str) -> str:
    """HMAC-SHA256 signature of the entry's critical fields."""
    key = _rotate_key()
    message = f"{payload_hash}:{previous_hash}".encode()
    return hmac.new(key, message, hashlib.sha256).hexdigest()


def compute_entry_hash(entry: AuditEntry) -> str:
    """SHA-256 of the full entry (used as previous_hash for next entry)."""
    canonical = json.dumps(
        {
            "entry_id": entry.entry_id,
            "timestamp": entry.timestamp,
            "agent_id": entry.agent_id,
            "action": entry.action,
            "payload_hash": entry.payload_hash,
            "previous_hash": entry.previous_hash,
            "hmac_signature": entry.hmac_signature,
        },
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode()).hexdigest()


# ── Audit Trail ───────────────────────────────────────────────────────────

class AuditTrail:
    """Append-only, HMAC-signed, hash-chained audit log.

    Storage: JSONL file (one JSON object per line).
    Each line is an independent AuditEntry with chain linkage.
    """

    def __init__(self, log_path: str = "data/audit_log.jsonl"):
        self._log_path = Path(log_path)
        self._log_path.parent.mkdir(parents=True, exist_ok=True)
        self._last_hash = self._load_last_hash()

    def _load_last_hash(self) -> str:
        """Load the hash of the last entry for chain continuity."""
        if not self._log_path.exists():
            return ""
        try:
            with open(self._log_path, "rb") as f:
                # Seek to end, read last line
                f.seek(0, 2)
                size = f.tell()
                if size == 0:
                    return ""
                # Read last 10KB to find last complete line
                f.seek(max(0, size - 10240))
                lines = f.read().decode(errors="ignore").strip().split("\n")
                last_line = lines[-1]
                entry = AuditEntry.model_validate_json(last_line)
                return entry.entry_hash
        except Exception as e:
            logger.error("failed_to_load_last_hash", error=str(e))
            return ""

    def append(
        self,
        agent_id: str,
        action: str,
        payload: Optional[dict[str, Any]] = None,
    ) -> AuditEntry:
        """Append a signed, chained audit entry."""
        payload = payload or {}
        p_hash = hash_payload(payload)
        sig = sign_entry(p_hash, self._last_hash)

        entry = AuditEntry(
            agent_id=agent_id,
            action=action,
            payload=payload,
            payload_hash=p_hash,
            previous_hash=self._last_hash,
            hmac_signature=sig,
        )
        entry.entry_hash = compute_entry_hash(entry)

        # Append to file
        with open(self._log_path, "a") as f:
            f.write(entry.model_dump_json() + "\n")

        self._last_hash = entry.entry_hash

        logger.info(
            "audit_entry_appended",
            entry_id=entry.entry_id,
            agent=agent_id,
            action=action,
        )

        return entry

    def verify_entry(self, entry: AuditEntry, expected_previous_hash: str) -> bool:
        """Verify a single entry's HMAC signature and chain link."""
        # Verify HMAC signature
        expected_sig = sign_entry(entry.payload_hash, entry.previous_hash)
        if not hmac.compare_digest(entry.hmac_signature, expected_sig):
            return False

        # Verify chain link
        if entry.previous_hash != expected_previous_hash:
            return False

        # Verify entry hash
        expected_hash = compute_entry_hash(entry)
        if entry.entry_hash != expected_hash:
            return False

        return True

    def verify_chain(self) -> ChainVerificationResult:
        """Verify the entire audit trail chain integrity.

        Walks every entry and checks:
        1. HMAC signature is valid
        2. previous_hash matches the actual previous entry's hash
        3. entry_hash is correctly computed

        Returns ChainVerificationResult with detailed status.
        """
        if not self._log_path.exists():
            return ChainVerificationResult(valid=True, total_entries=0, verified_entries=0)

        entries: list[AuditEntry] = []
        try:
            with open(self._log_path, "r") as f:
                for i, line in enumerate(f):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entries.append(AuditEntry.model_validate_json(line))
                    except Exception as e:
                        return ChainVerificationResult(
                            valid=False,
                            total_entries=i + 1,
                            verified_entries=i,
                            broken_at=i,
                            error=f"Invalid entry at line {i}: {e}",
                        )
        except Exception as e:
            return ChainVerificationResult(
                valid=False,
                total_entries=0,
                verified_entries=0,
                error=f"Failed to read audit log: {e}",
            )

        if not entries:
            return ChainVerificationResult(valid=True, total_entries=0, verified_entries=0)

        prev_hash = ""
        for i, entry in enumerate(entries):
            if not self.verify_entry(entry, prev_hash):
                return ChainVerificationResult(
                    valid=False,
                    total_entries=len(entries),
                    verified_entries=i,
                    broken_at=i,
                    error=f"Chain broken at entry {i} (id={entry.entry_id}): "
                          f"expected previous_hash={prev_hash[:16]}..., "
                          f"got={entry.previous_hash[:16]}...",
                )
            prev_hash = entry.entry_hash

        logger.info(
            "audit_chain_verified",
            total=len(entries),
            valid=True,
        )

        return ChainVerificationResult(
            valid=True,
            total_entries=len(entries),
            verified_entries=len(entries),
        )

    def get_entries(
        self,
        agent_id: Optional[str] = None,
        action: Optional[str] = None,
        limit: int = 100,
    ) -> list[AuditEntry]:
        """Query audit entries with optional filters."""
        if not self._log_path.exists():
            return []

        entries: list[AuditEntry] = []
        with open(self._log_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = AuditEntry.model_validate_json(line)
                    if agent_id and entry.agent_id != agent_id:
                        continue
                    if action and entry.action != action:
                        continue
                    entries.append(entry)
                    if len(entries) >= limit:
                        break
                except Exception:
                    continue

        return entries


# ── Singleton ─────────────────────────────────────────────────────────────

_audit_trail: Optional[AuditTrail] = None


def get_audit_trail() -> AuditTrail:
    global _audit_trail
    if _audit_trail is None:
        log_path = "data/audit_log.jsonl"
        _audit_trail = AuditTrail(log_path=log_path)
    return _audit_trail


def log_agent_action(
    agent_id: str,
    action: str,
    payload: Optional[dict[str, Any]] = None,
) -> AuditEntry:
    """Convenience function to log an agent action to the audit trail."""
    return get_audit_trail().append(agent_id, action, payload)
