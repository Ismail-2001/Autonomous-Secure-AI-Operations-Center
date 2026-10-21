import os
import sys

from src.asoc.core.logging import get_logger

logger = get_logger("asoc.checks")

WARNINGS: list[str] = []
FATAL: list[str] = []


def _warn(msg: str) -> None:
    WARNINGS.append(msg)
    logger.warning("boot_check_warning", check=msg)


def _fail(msg: str) -> None:
    FATAL.append(msg)
    logger.error("boot_check_failed", check=msg)


async def run_boot_checks() -> list[str]:
    WARNINGS.clear()
    FATAL.clear()

    _check_secrets()
    _check_database()
    _check_redis()
    _check_llm()
    _check_vault()
    _check_pinecone()
    _check_env()

    if FATAL:
        for msg in FATAL:
            logger.critical("boot_fatal", check=msg)
        sys.exit(1)

    if WARNINGS:
        for msg in WARNINGS:
            logger.warning("boot_warning", check=msg)

    logger.info("boot_checks_complete", warnings=len(WARNINGS))
    return WARNINGS


def _is_prod() -> bool:
    env = os.getenv("ENVIRONMENT", "").lower()
    return env in ("production", "prod", "staging")


def _check_secrets() -> None:
    is_prod = _is_prod()

    # HMAC Secret
    hmac_sec = os.getenv("HMAC_SECRET", "")
    if not hmac_sec:
        _fail("HMAC_SECRET not set — EventStore will fail to initialize")
    elif is_prod and (hmac_sec in ("dev-token-asoc-2026", "changeme", "secret") or len(hmac_sec) < 16):
        _fail("HMAC_SECRET is weak or default in production environment")

    # WS API Token
    ws_token = os.getenv("WS_API_TOKEN", "")
    if not ws_token:
        _fail("WS_API_TOKEN not set — WebSocket auth will reject all connections")
    elif is_prod and (ws_token in ("dev-token-asoc-2026", "changeme", "dev-ws-token") or len(ws_token) < 16):
        _fail("WS_API_TOKEN is weak or default in production environment")

    # Admin Password
    admin_pw = os.getenv("ADMIN_PASSWORD", "")
    if is_prod:
        if not admin_pw or admin_pw in ("changeme", "admin", "admin123", "password") or len(admin_pw) < 8:
            _fail("ADMIN_PASSWORD is unset, default, or fewer than 8 characters in production")
    elif "changeme" in admin_pw:
        _warn("ADMIN_PASSWORD is set to default 'changeme'")

    # Postgres Password
    pg_pw = os.getenv("POSTGRES_PASSWORD", "")
    if "changeme" in pg_pw:
        if is_prod:
            _fail("POSTGRES_PASSWORD is still default 'changeme' in production")
        else:
            _warn("POSTGRES_PASSWORD is still default 'changeme123' — set a strong password")


def _check_database() -> None:
    is_prod = _is_prod()
    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        if is_prod:
            _fail("DATABASE_URL must be configured in production — cannot fall back to JSONL")
        else:
            _warn("DATABASE_URL not set — using JSONL event store")
    elif "changeme" in db_url:
        if is_prod:
            _fail("DATABASE_URL contains default password 'changeme' in production")
        else:
            _warn("DATABASE_URL contains default password — update before production deploy")


def _check_redis() -> None:
    is_prod = _is_prod()
    redis_url = os.getenv("REDIS_URL", "")
    if not redis_url:
        if is_prod:
            _fail("REDIS_URL must be configured in production for distributed locking and tokens")
        else:
            _warn("REDIS_URL not set — message bus unavailable")
    elif "changeme" in redis_url:
        if is_prod:
            _fail("REDIS_URL contains default password in production")
        else:
            _warn("REDIS_URL contains default password — update before production deploy")


def _check_llm() -> None:
    keys = [
        bool(os.getenv("OPENAI_API_KEY")),
        bool(os.getenv("ANTHROPIC_API_KEY")),
        bool(os.getenv("DEEPSEEK_API_KEY")),
        bool(os.getenv("GROQ_API_KEY")),
    ]
    if not any(keys):
        if _is_prod():
            _fail("No production LLM API key configured (OPENAI, ANTHROPIC, DEEPSEEK, or GROQ)")
        else:
            _warn("No LLM API keys configured — agent reasoning will fall back to MockProvider")


def _check_vault() -> None:
    vault_addr = os.getenv("VAULT_ADDR", "")
    if vault_addr and not os.getenv("VAULT_TOKEN"):
        _warn("VAULT_ADDR is set but VAULT_TOKEN is missing — secrets will not resolve")


def _check_pinecone() -> None:
    if not os.getenv("PINECONE_API_KEY"):
        _warn("PINECONE_API_KEY not set — vector search uses in-memory MockVectorProvider")


def _check_env() -> None:
    if _is_prod() and os.getenv("DEBUG", "").lower() in ("true", "1"):
        _fail("DEBUG=True in production environment — this is a security risk")
