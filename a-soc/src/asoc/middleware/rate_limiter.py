"""Per-agent rate limiter with role-based and agent-specific token buckets.

Each agent gets its own token bucket with limits tuned to its risk level:
- TelemetryAgent: high throughput (ingestion)
- DetectionAgent: moderate (LLM calls are slow)
- ResponseAgent: low throughput (destructive actions)
- ComplianceAgent: low throughput (audit writes)
"""
import time
from typing import Dict, Optional

from fastapi import HTTPException, Request, status

from src.asoc.core.logging import get_logger

logger = get_logger("asoc.rate_limiter")


class TokenBucket:
    """Thread-safe token bucket with refill."""

    __slots__ = ("_capacity", "_tokens", "_refill_rate", "_last_refill")

    def __init__(self, capacity: int, refill_rate: float):
        self._capacity = float(capacity)
        self._tokens = float(capacity)
        self._refill_rate = refill_rate  # tokens per second
        self._last_refill = time.monotonic()

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_refill
        if elapsed > 0:
            self._tokens = min(self._capacity, self._tokens + elapsed * self._refill_rate)
            self._last_refill = now

    def consume(self, tokens: float = 1.0) -> bool:
        self._refill()
        if self._tokens >= tokens:
            self._tokens -= tokens
            return True
        return False

    @property
    def available(self) -> float:
        self._refill()
        return self._tokens


# ── Agent Rate Limits ─────────────────────────────────────────────────────
# Tuned by risk level: destructive agents get lower limits.

AGENT_RATE_LIMITS: Dict[str, tuple[int, float]] = {
    # Agent name → (capacity, refill_rate_per_sec)
    "TelemetryAgent": (200, 20.0),   # High throughput ingestion
    "DetectionAgent": (60, 5.0),     # Moderate — LLM calls are the bottleneck
    "SupervisorAgent": (100, 10.0),  # Orchestration overhead
    "ForensicsAgent": (40, 3.0),     # Vector store queries
    "ResponseAgent": (15, 1.0),      # LOW — destructive actions, strict limit
    "ComplianceAgent": (30, 2.0),    # Audit writes
    "NotificationAgent": (50, 5.0),  # Webhook calls
}

# Role-based rate limit multipliers
ROLE_MULTIPLIERS = {
    "readonly": 0.5,
    "analyst": 1.0,
    "supervisor": 1.5,
    "admin": 2.0,
}

# Per-endpoint overrides (path prefix → capacity, refill_rate)
ENDPOINT_OVERRIDES = {
    "/api/hunting/events": (30, 2.0),
    "/api/hunting/timeline": (20, 1.5),
    "/health": (500, 50.0),  # Health checks are cheap
    "/metrics": (100, 10.0),
}


class AgentRateLimiter:
    """Rate limiter with per-agent and per-role token buckets."""

    def __init__(self) -> None:
        self._agent_buckets: Dict[str, TokenBucket] = {}
        self._ip_buckets: Dict[str, TokenBucket] = {}
        self._endpoint_buckets: Dict[str, TokenBucket] = {}
        self._last_cleanup = time.monotonic()
        self._cleanup_interval = 300.0

    def _get_agent_bucket(self, agent_name: str) -> TokenBucket:
        if agent_name not in self._agent_buckets:
            capacity, refill = AGENT_RATE_LIMITS.get(agent_name, (30, 2.0))
            self._agent_buckets[agent_name] = TokenBucket(capacity, refill)
        return self._agent_buckets[agent_name]

    def _get_ip_bucket(self, client_ip: str) -> TokenBucket:
        if client_ip not in self._ip_buckets:
            self._ip_buckets[client_ip] = TokenBucket(capacity=120, refill_rate=2.0)
        return self._ip_buckets[client_ip]

    def _get_endpoint_bucket(self, path: str) -> TokenBucket:
        for prefix, (cap, refill) in ENDPOINT_OVERRIDES.items():
            if path.startswith(prefix):
                if path not in self._endpoint_buckets:
                    self._endpoint_buckets[path] = TokenBucket(cap, refill)
                return self._endpoint_buckets[path]
        # Default endpoint bucket
        if "_default" not in self._endpoint_buckets:
            self._endpoint_buckets["_default"] = TokenBucket(capacity=60, refill_rate=5.0)
        return self._endpoint_buckets["_default"]

    def _cleanup(self) -> None:
        now = time.monotonic()
        if now - self._last_cleanup > self._cleanup_interval:
            # Prune stale IP buckets (older than cleanup interval)
            stale_ips = [
                ip for ip, bucket in self._ip_buckets.items()
                if now - bucket._last_refill > self._cleanup_interval
            ]
            for ip in stale_ips:
                del self._ip_buckets[ip]
            self._last_cleanup = now

    def check_agent(
        self,
        agent_name: str,
        role: str = "analyst",
        tokens: float = 1.0,
    ) -> bool:
        """Check rate limit for a specific agent, adjusted by role."""
        multiplier = ROLE_MULTIPLIERS.get(role, 1.0)
        adjusted_tokens = tokens / multiplier

        bucket = self._get_agent_bucket(agent_name)
        allowed = bucket.consume(adjusted_tokens)

        if not allowed:
            logger.warning(
                "agent_rate_limited",
                agent=agent_name,
                role=role,
                available=bucket.available,
            )
        return allowed

    async def check_request(
        self,
        request: Request,
        agent_name: Optional[str] = None,
        role: str = "analyst",
    ) -> None:
        """Check rate limit for an HTTP request (IP + endpoint + optional agent)."""
        self._cleanup()

        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path

        # IP-level check
        ip_bucket = self._get_ip_bucket(client_ip)
        if not ip_bucket.consume():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="IP rate limit exceeded",
                headers={"Retry-After": "5"},
            )

        # Endpoint-level check
        endpoint_bucket = self._get_endpoint_bucket(path)
        if not endpoint_bucket.consume():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Endpoint rate limit exceeded",
                headers={"Retry-After": "3"},
            )

        # Agent-level check
        if agent_name:
            if not self.check_agent(agent_name, role):
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Agent {agent_name} rate limit exceeded",
                    headers={"Retry-After": "10"},
                )

    def get_stats(self) -> dict:
        """Return current rate limiter stats for monitoring."""
        return {
            "agents": {
                name: {
                    "capacity": AGENT_RATE_LIMITS.get(name, (0, 0))[0],
                    "available": bucket.available,
                }
                for name, bucket in self._agent_buckets.items()
            },
            "ip_buckets": len(self._ip_buckets),
            "endpoint_buckets": len(self._endpoint_buckets),
        }


# ── Singleton ─────────────────────────────────────────────────────────────

_agent_limiter = AgentRateLimiter()


async def check_agent_rate_limit(
    request: Request,
    agent_name: Optional[str] = None,
    role: str = "analyst",
) -> None:
    """FastAPI-compatible rate limit check."""
    await _agent_limiter.check_request(request, agent_name, role)


def get_agent_rate_limiter() -> AgentRateLimiter:
    return _agent_limiter
