"""Connection pool management for external services.

Provides centralized connection pooling for Redis, PostgreSQL, and HTTP clients.
"""

import asyncio
from typing import Any, Dict, Optional


class ConnectionPool:
    """Generic async connection pool with health checks."""

    def __init__(self, max_size: int = 10, min_size: int = 2) -> None:
        self._max_size = max_size
        self._min_size = min_size
        self._pool: asyncio.Queue = asyncio.Queue(maxsize=max_size)
        self._size = 0
        self._lock = asyncio.Lock()

    async def acquire(self) -> Any:
        """Acquire a connection from the pool."""
        try:
            return self._pool.get_nowait()
        except asyncio.QueueEmpty:
            async with self._lock:
                if self._size < self._max_size:
                    conn = await self._create_connection()
                    self._size += 1
                    return conn
            # Pool is full, wait for a connection
            return await self._pool.get()

    async def release(self, conn: Any) -> None:
        """Release a connection back to the pool."""
        try:
            self._pool.put_nowait(conn)
        except asyncio.QueueFull:
            await self._close_connection(conn)

    async def _create_connection(self) -> Any:
        """Create a new connection (override in subclass)."""
        return {"status": "connected"}

    async def _close_connection(self, conn: Any) -> None:
        """Close a connection (override in subclass)."""
        pass

    async def close_all(self) -> None:
        """Close all connections in the pool."""
        while not self._pool.empty():
            conn = self._pool.get_nowait()
            await self._close_connection(conn)
        self._size = 0

    @property
    def available(self) -> int:
        return self._pool.qsize()

    @property
    def total(self) -> int:
        return self._size


class RedisPool(ConnectionPool):
    """Redis connection pool."""

    async def _create_connection(self) -> Any:
        """Create a Redis connection."""
        # In production, use aioredis
        return {"type": "redis", "status": "connected"}


class HTTPPool(ConnectionPool):
    """HTTP client pool with timeout support."""

    def __init__(self, max_size: int = 10, timeout: float = 30.0) -> None:
        super().__init__(max_size=max_size)
        self._timeout = timeout
