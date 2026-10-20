import logging
from typing import Optional

from src.asoc.core.config import settings

logger = logging.getLogger("asoc.checkpoint")


async def create_checkpointer():
    """Create PostgreSQL-backed checkpointer for durable agent memory.

    Falls back to in-memory MemorySaver if PostgreSQL is unavailable.
    """
    try:
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

        saver = AsyncPostgresSaver.from_conn_string(settings.DATABASE_URL)
        await saver.setup()
        logger.info("postgresql_checkpointer_initialized")
        return saver
    except Exception as e:
        logger.warning("postgresql_checkpointer_unavailable", error=str(e), fallback="memory")
        from langgraph.checkpoint.memory import MemorySaver

        return MemorySaver()
