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


def _check_secrets() -> None:
    if "HMAC_SECRET" not in os.environ:
        _warn("HMAC_SECRET not set — using default, rotate immediately in production")
    if "WS_API_TOKEN" not in os.environ:
        _fail("WS_API_TOKEN not set — WebSocket auth will reject all connections")
    if "changeme" in os.getenv("POSTGRES_PASSWORD", ""):
        _warn("POSTGRES_PASSWORD is still default 'changeme123' — set a strong password")


def _check_database() -> None:
    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        _warn("DATABASE_URL not set — using JSONL event store")
    elif "changeme" in db_url:
        _warn("DATABASE_URL contains default password — update before production deploy")


def _check_redis() -> None:
    redis_url = os.getenv("REDIS_URL", "")
    if not redis_url:
        _warn("REDIS_URL not set — message bus unavailable")
    elif "changeme" in redis_url:
        _warn("REDIS_URL contains default password — update before production deploy")


def _check_llm() -> None:
    keys = [
        bool(os.getenv("OPENAI_API_KEY")),
        bool(os.getenv("ANTHROPIC_API_KEY")),
        bool(os.getenv("DEEPSEEK_API_KEY")),
    ]
    if not any(keys):
        _warn("No LLM API keys configured — agent reasoning will fall back to MockProvider")


def _check_vault() -> None:
    vault_addr = os.getenv("VAULT_ADDR", "")
    if vault_addr and not os.getenv("VAULT_TOKEN"):
        _warn("VAULT_ADDR is set but VAULT_TOKEN is missing — secrets will not resolve")


def _check_pinecone() -> None:
    if not os.getenv("PINECONE_API_KEY"):
        _warn("PINECONE_API_KEY not set — vector search uses in-memory MockVectorProvider")


def _check_env() -> None:
    if os.getenv("ENVIRONMENT", "").lower() == "production" and os.getenv("DEBUG", "").lower() in ("true", "1"):
        _fail("DEBUG=True in production environment — this is a security risk")
