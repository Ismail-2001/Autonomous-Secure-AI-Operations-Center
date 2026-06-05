import asyncio
import os
from typing import Optional

import asyncpg

from core.logging import get_logger

logger = get_logger("asoc.database")


class DatabasePool:
    def __init__(self, dsn: str, min_size: int = 5, max_size: int = 20):
        self._dsn = dsn
        self._min_size = min_size
        self._max_size = max_size
        self._pool: Optional[asyncpg.Pool] = None

    async def connect(self) -> None:
        if self._pool is not None:
            return
        self._pool = await asyncpg.create_pool(
            dsn=self._dsn,
            min_size=self._min_size,
            max_size=self._max_size,
            command_timeout=10,
        )
        logger.info("database_pool_created", min_size=self._min_size, max_size=self._max_size)
        await self._run_migrations()

    async def close(self) -> None:
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("database_pool_closed")

    @property
    def pool(self) -> asyncpg.Pool:
        if self._pool is None:
            raise RuntimeError("Database pool not initialized. Call connect() first.")
        return self._pool

    async def _run_migrations(self) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                    id UUID PRIMARY KEY,
                    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    event_type TEXT NOT NULL,
                    agent TEXT NOT NULL,
                    payload JSONB NOT NULL DEFAULT '{}',
                    signature TEXT NOT NULL DEFAULT '',
                    trace_id TEXT NOT NULL DEFAULT '',
                    incident_id TEXT NOT NULL DEFAULT ''
                );
                CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
                CREATE INDEX IF NOT EXISTS idx_events_agent ON events(agent);
                CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
                CREATE INDEX IF NOT EXISTS idx_events_incident ON events(incident_id);
            """
            )
            logger.info("database_migrations_complete")


_db_pool: Optional[DatabasePool] = None
_lock = asyncio.Lock()


async def get_db_pool() -> DatabasePool:
    global _db_pool
    if _db_pool is None:
        async with _lock:
            if _db_pool is None:
                dsn = os.getenv("DATABASE_URL", "postgresql+asyncpg://asoc_user:changeme123@localhost:5432/asoc_db")
                cleaned = dsn.replace("+asyncpg", "")
                _db_pool = DatabasePool(cleaned)
                await _db_pool.connect()
    return _db_pool


async def close_db_pool() -> None:
    global _db_pool
    if _db_pool:
        await _db_pool.close()
        _db_pool = None
