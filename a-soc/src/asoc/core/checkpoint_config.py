from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from src.asoc.core.config import settings

logger = logging.getLogger("asoc.checkpoint")

_checkpointer_instance = None


async def create_checkpointer():
    """Create PostgreSQL-backed checkpointer for durable agent memory.

    Uses AsyncPostgresSaver for non-blocking checkpoint operations.
    Falls back to in-memory MemorySaver if PostgreSQL is unavailable.
    Every agent run is resumable from last checkpoint.
    """
    global _checkpointer_instance
    if _checkpointer_instance is not None:
        return _checkpointer_instance

    try:
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

        saver = AsyncPostgresSaver.from_conn_string(settings.DATABASE_URL)
        await saver.setup()
        _checkpointer_instance = saver
        logger.info("postgresql_checkpointer_initialized", database=settings.DATABASE_URL.split("@")[-1] if "@" in settings.DATABASE_URL else "configured")
        return saver
    except Exception as e:
        logger.warning("postgresql_checkpointer_unavailable", error=str(e), fallback="memory")
        from langgraph.checkpoint.memory import MemorySaver

        _checkpointer_instance = MemorySaver()
        return _checkpointer_instance


def get_checkpointer():
    """Get the singleton checkpointer instance. Must call create_checkpointer() first."""
    global _checkpointer_instance
    if _checkpointer_instance is None:
        raise RuntimeError("Checkpointer not initialized. Call create_checkpointer() first.")
    return _checkpointer_instance


async def get_or_create_checkpointer():
    """Get existing or create new checkpointer."""
    global _checkpointer_instance
    if _checkpointer_instance is not None:
        return _checkpointer_instance
    return await create_checkpointer()


@asynccontextmanager
async def checkpoint_scope():
    """Context manager for checkpoint lifecycle."""
    checkpointer = await get_or_create_checkpointer()
    try:
        yield checkpointer
    finally:
        pass


class CheckpointConfig:
    """Configuration for checkpoint behavior."""

    def __init__(
        self,
        thread_id: str = "default",
        checkpoint_ns: str = "a-soc",
        checkpoint_id: Optional[str] = None,
        durable: bool = True,
    ):
        self.thread_id = thread_id
        self.checkpoint_ns = checkpoint_ns
        self.checkpoint_id = checkpoint_id
        self.durable = durable

    @property
    def config(self) -> dict:
        cfg: dict = {"configurable": {"thread_id": self.thread_id, "checkpoint_ns": self.checkpoint_ns}}
        if self.checkpoint_id:
            cfg["configurable"]["checkpoint_id"] = self.checkpoint_id
        return cfg

    @classmethod
    def for_incident(cls, incident_id: str) -> "CheckpointConfig":
        return cls(thread_id=f"incident-{incident_id}", checkpoint_ns="a-soc-incidents")

    @classmethod
    def for_agent(cls, agent_name: str, run_id: str) -> "CheckpointConfig":
        return cls(thread_id=f"agent-{agent_name}-{run_id}", checkpoint_ns="a-soc-agents")


class RunTracker:
    """Tracks agent run lifecycle with checkpoint support."""

    def __init__(self):
        self._active_runs: dict[str, dict] = {}

    def start_run(self, run_id: str, incident_id: str, agent_name: str) -> dict:
        run_info = {
            "run_id": run_id,
            "incident_id": incident_id,
            "agent_name": agent_name,
            "status": "running",
            "started_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
            "steps": [],
        }
        self._active_runs[run_id] = run_info
        return run_info

    def record_step(self, run_id: str, step_name: str, success: bool, details: Optional[dict] = None) -> None:
        if run_id in self._active_runs:
            self._active_runs[run_id]["steps"].append({
                "step": step_name,
                "success": success,
                "details": details or {},
            })

    def complete_run(self, run_id: str, status: str = "completed") -> Optional[dict]:
        if run_id in self._active_runs:
            run = self._active_runs.pop(run_id)
            run["status"] = status
            run["completed_at"] = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
            return run
        return None

    def get_active_run(self, run_id: str) -> Optional[dict]:
        return self._active_runs.get(run_id)

    @property
    def active_count(self) -> int:
        return len(self._active_runs)


run_tracker = RunTracker()
