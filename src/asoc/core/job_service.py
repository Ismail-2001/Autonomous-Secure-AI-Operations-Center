"""Distributed Job Lifecycle & Worker Queue Management.

Provides concurrency-safe job scheduling, claiming (SELECT ... FOR UPDATE SKIP LOCKED),
heartbeating, stale worker recovery, checkpoint state tracking, and cancellation.
"""

import asyncio
import json
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

from src.asoc.core.config import settings
from src.asoc.core.logging import get_logger

logger = get_logger("asoc.jobs")


class JobState(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    RETRYING = "RETRYING"
    CANCELLED = "CANCELLED"


class Job(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    incident_id: str
    state: JobState = JobState.PENDING
    attempt: int = 0
    max_attempts: int = 3
    locked_by: Optional[str] = None
    locked_at: Optional[datetime] = None
    heartbeat_at: Optional[datetime] = None
    error: Optional[str] = None
    state_payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# In-memory storage for offline / testing / development mode
_in_memory_jobs: dict[str, Job] = {}
_job_lock = asyncio.Lock()


class JobService:
    """Service handling job dispatch, claiming, and lifecycle tracking."""

    def __init__(self, database_url: Optional[str] = None):
        self.db_url = database_url or settings.DATABASE_URL
        if self.db_url:
            self.clean_db_url = self.db_url.replace("postgresql+asyncpg://", "postgresql://")
        else:
            self.clean_db_url = None

    async def _get_pg_conn(self):
        """Acquire asyncpg connection if Postgres is available."""
        if not self.clean_db_url:
            return None
        try:
            import asyncpg

            conn = await asyncpg.connect(self.clean_db_url, timeout=3.0)
            return conn
        except Exception:
            return None

    async def enqueue_job(
        self,
        incident_id: str,
        max_attempts: int = 3,
        state_payload: Optional[dict[str, Any]] = None,
    ) -> Job:
        """Enqueue an incident investigation job."""
        job = Job(
            incident_id=incident_id,
            state=JobState.PENDING,
            max_attempts=max_attempts,
            state_payload=state_payload or {},
        )

        conn = await self._get_pg_conn()
        if conn:
            try:
                payload_json = json.dumps(job.state_payload)
                await conn.execute(
                    """
                    INSERT INTO jobs (id, incident_id, state, attempt, max_attempts, state_payload, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
                    """,
                    job.id,
                    job.incident_id,
                    job.state.value,
                    job.attempt,
                    job.max_attempts,
                    payload_json,
                    job.created_at,
                    job.updated_at,
                )
                logger.info("job_enqueued_db", job_id=job.id, incident_id=incident_id)
                return job
            except Exception as e:
                logger.warning("db_enqueue_failed_falling_back_to_memory", error=str(e))
            finally:
                await conn.close()

        # In-memory fallback
        async with _job_lock:
            _in_memory_jobs[job.id] = job
        logger.info("job_enqueued_memory", job_id=job.id, incident_id=incident_id)
        return job

    async def claim_next_job(
        self,
        worker_id: str,
        stale_timeout_seconds: int = 300,
    ) -> Optional[Job]:
        """Claim next pending/retrying job or recover a stale abandoned job using SKIP LOCKED."""
        conn = await self._get_pg_conn()
        if conn:
            try:
                row = await conn.fetchrow(
                    f"""
                    WITH candidate AS (
                        SELECT id FROM jobs
                        WHERE state IN ('PENDING', 'RETRYING')
                           OR (state = 'RUNNING' AND heartbeat_at < NOW() - INTERVAL '{int(stale_timeout_seconds)} seconds')
                        ORDER BY created_at ASC
                        FOR UPDATE SKIP LOCKED
                        LIMIT 1
                    )
                    UPDATE jobs
                    SET state = 'RUNNING',
                        locked_by = $1,
                        locked_at = NOW(),
                        heartbeat_at = NOW(),
                        attempt = attempt + 1,
                        updated_at = NOW()
                    FROM candidate
                    WHERE jobs.id = candidate.id
                    RETURNING jobs.id, jobs.incident_id, jobs.state, jobs.attempt, jobs.max_attempts,
                              jobs.locked_by, jobs.locked_at, jobs.heartbeat_at, jobs.error,
                              jobs.state_payload, jobs.created_at, jobs.updated_at;
                    """,
                    worker_id,
                )
                if row:
                    payload = row["state_payload"]
                    if isinstance(payload, str):
                        payload = json.loads(payload)
                    job = Job(
                        id=row["id"],
                        incident_id=row["incident_id"],
                        state=JobState(row["state"]),
                        attempt=row["attempt"],
                        max_attempts=row["max_attempts"],
                        locked_by=row["locked_by"],
                        locked_at=row["locked_at"],
                        heartbeat_at=row["heartbeat_at"],
                        error=row["error"],
                        state_payload=payload if isinstance(payload, dict) else {},
                        created_at=row["created_at"],
                        updated_at=row["updated_at"],
                    )
                    logger.info("job_claimed_db", job_id=job.id, worker_id=worker_id, attempt=job.attempt)
                    return job
            except Exception as e:
                logger.warning("db_claim_failed_falling_back_to_memory", error=str(e))
            finally:
                await conn.close()

        # In-memory fallback
        async with _job_lock:
            now = datetime.now(timezone.utc)
            for j in sorted(_in_memory_jobs.values(), key=lambda x: x.created_at):
                is_stale = False
                if j.state == JobState.RUNNING and j.heartbeat_at:
                    delta = (now - j.heartbeat_at).total_seconds()
                    if delta > stale_timeout_seconds:
                        is_stale = True

                if j.state in (JobState.PENDING, JobState.RETRYING) or is_stale:
                    j.state = JobState.RUNNING
                    j.locked_by = worker_id
                    j.locked_at = now
                    j.heartbeat_at = now
                    j.attempt += 1
                    j.updated_at = now
                    logger.info(
                        "job_claimed_memory",
                        job_id=j.id,
                        worker_id=worker_id,
                        attempt=j.attempt,
                        recovered_stale=is_stale,
                    )
                    return j
        return None

    async def heartbeat_job(self, job_id: str, worker_id: str) -> bool:
        """Send liveness heartbeat for an active job."""
        conn = await self._get_pg_conn()
        now = datetime.now(timezone.utc)
        if conn:
            try:
                res = await conn.execute(
                    """
                    UPDATE jobs
                    SET heartbeat_at = NOW(), updated_at = NOW()
                    WHERE id = $1 AND locked_by = $2 AND state = 'RUNNING'
                    """,
                    job_id,
                    worker_id,
                )
                return "UPDATE 1" in res
            except Exception as e:
                logger.warning("db_heartbeat_failed", error=str(e))
            finally:
                await conn.close()

        # In-memory fallback
        async with _job_lock:
            j = _in_memory_jobs.get(job_id)
            if j and j.locked_by == worker_id and j.state == JobState.RUNNING:
                j.heartbeat_at = now
                j.updated_at = now
                return True
        return False

    async def complete_job(
        self,
        job_id: str,
        state_payload: Optional[dict[str, Any]] = None,
    ) -> bool:
        """Mark a job as COMPLETED."""
        conn = await self._get_pg_conn()
        now = datetime.now(timezone.utc)
        payload_json = json.dumps(state_payload or {}) if state_payload else None

        if conn:
            try:
                if payload_json:
                    query = """
                        UPDATE jobs
                        SET state = 'COMPLETED', locked_by = NULL, locked_at = NULL,
                            state_payload = $2::jsonb, updated_at = NOW()
                        WHERE id = $1
                    """
                    res = await conn.execute(query, job_id, payload_json)
                else:
                    query = """
                        UPDATE jobs
                        SET state = 'COMPLETED', locked_by = NULL, locked_at = NULL, updated_at = NOW()
                        WHERE id = $1
                    """
                    res = await conn.execute(query, job_id)
                logger.info("job_completed_db", job_id=job_id)
                return "UPDATE 1" in res
            except Exception as e:
                logger.warning("db_complete_failed", error=str(e))
            finally:
                await conn.close()

        # In-memory fallback
        async with _job_lock:
            j = _in_memory_jobs.get(job_id)
            if j:
                j.state = JobState.COMPLETED
                j.locked_by = None
                j.locked_at = None
                if state_payload:
                    j.state_payload = state_payload
                j.updated_at = now
                logger.info("job_completed_memory", job_id=job_id)
                return True
        return False

    async def fail_job(
        self,
        job_id: str,
        error_message: str,
        can_retry: bool = True,
    ) -> bool:
        """Record job failure and determine if it should be retried."""
        job = await self.get_job(job_id)
        if not job:
            return False

        now = datetime.now(timezone.utc)
        should_retry = can_retry and (job.attempt < job.max_attempts)
        new_state = JobState.RETRYING if should_retry else JobState.FAILED

        conn = await self._get_pg_conn()
        if conn:
            try:
                res = await conn.execute(
                    """
                    UPDATE jobs
                    SET state = $2, locked_by = NULL, locked_at = NULL,
                        error = $3, updated_at = NOW()
                    WHERE id = $1
                    """,
                    job_id,
                    new_state.value,
                    error_message,
                )
                logger.info("job_failed_db", job_id=job_id, state=new_state.value, error=error_message)
                return "UPDATE 1" in res
            except Exception as e:
                logger.warning("db_fail_failed", error=str(e))
            finally:
                await conn.close()

        # In-memory fallback
        async with _job_lock:
            j = _in_memory_jobs.get(job_id)
            if j:
                j.state = new_state
                j.locked_by = None
                j.locked_at = None
                j.error = error_message
                j.updated_at = now
                logger.info("job_failed_memory", job_id=job_id, state=new_state.value, error=error_message)
                return True
        return False

    async def cancel_job(self, job_id: str, reason: str = "Cancelled by user") -> bool:
        """Cancel an in-progress or queued job."""
        conn = await self._get_pg_conn()
        now = datetime.now(timezone.utc)
        if conn:
            try:
                res = await conn.execute(
                    """
                    UPDATE jobs
                    SET state = 'CANCELLED', locked_by = NULL, locked_at = NULL,
                        error = $2, updated_at = NOW()
                    WHERE id = $1 AND state IN ('PENDING', 'RUNNING', 'RETRYING')
                    """,
                    job_id,
                    reason,
                )
                logger.info("job_cancelled_db", job_id=job_id, reason=reason)
                return "UPDATE 1" in res
            except Exception as e:
                logger.warning("db_cancel_failed", error=str(e))
            finally:
                await conn.close()

        # In-memory fallback
        async with _job_lock:
            j = _in_memory_jobs.get(job_id)
            if j and j.state in (JobState.PENDING, JobState.RUNNING, JobState.RETRYING):
                j.state = JobState.CANCELLED
                j.locked_by = None
                j.locked_at = None
                j.error = reason
                j.updated_at = now
                logger.info("job_cancelled_memory", job_id=job_id, reason=reason)
                return True
        return False

    async def get_job(self, job_id: str) -> Optional[Job]:
        """Fetch job details by ID."""
        conn = await self._get_pg_conn()
        if conn:
            try:
                row = await conn.fetchrow("SELECT * FROM jobs WHERE id = $1", job_id)
                if row:
                    payload = row["state_payload"]
                    if isinstance(payload, str):
                        payload = json.loads(payload)
                    return Job(
                        id=row["id"],
                        incident_id=row["incident_id"],
                        state=JobState(row["state"]),
                        attempt=row["attempt"],
                        max_attempts=row["max_attempts"],
                        locked_by=row["locked_by"],
                        locked_at=row["locked_at"],
                        heartbeat_at=row["heartbeat_at"],
                        error=row["error"],
                        state_payload=payload if isinstance(payload, dict) else {},
                        created_at=row["created_at"],
                        updated_at=row["updated_at"],
                    )
            except Exception as e:
                logger.warning("db_get_job_failed", error=str(e))
            finally:
                await conn.close()

        # In-memory fallback
        async with _job_lock:
            return _in_memory_jobs.get(job_id)

    async def list_jobs(
        self,
        incident_id: Optional[str] = None,
        state: Optional[JobState] = None,
        limit: int = 50,
    ) -> list[Job]:
        """List jobs matching criteria."""
        conn = await self._get_pg_conn()
        if conn:
            try:
                clauses = []
                params = []
                idx = 1
                if incident_id:
                    clauses.append(f"incident_id = ${idx}")
                    params.append(incident_id)
                    idx += 1
                if state:
                    clauses.append(f"state = ${idx}")
                    params.append(state.value)
                    idx += 1

                where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
                sql = f"SELECT * FROM jobs {where_sql} ORDER BY created_at DESC LIMIT {int(limit)}"
                rows = await conn.fetch(sql, *params)
                jobs = []
                for r in rows:
                    payload = r["state_payload"]
                    if isinstance(payload, str):
                        payload = json.loads(payload)
                    jobs.append(
                        Job(
                            id=r["id"],
                            incident_id=r["incident_id"],
                            state=JobState(r["state"]),
                            attempt=r["attempt"],
                            max_attempts=r["max_attempts"],
                            locked_by=r["locked_by"],
                            locked_at=r["locked_at"],
                            heartbeat_at=r["heartbeat_at"],
                            error=r["error"],
                            state_payload=payload if isinstance(payload, dict) else {},
                            created_at=r["created_at"],
                            updated_at=r["updated_at"],
                        )
                    )
                return jobs
            except Exception as e:
                logger.warning("db_list_jobs_failed", error=str(e))
            finally:
                await conn.close()

        # In-memory fallback
        async with _job_lock:
            filtered = list(_in_memory_jobs.values())
            if incident_id:
                filtered = [j for j in filtered if j.incident_id == incident_id]
            if state:
                filtered = [j for j in filtered if j.state == state]
            filtered.sort(key=lambda j: j.created_at, reverse=True)
            return filtered[:limit]


_job_service: Optional[JobService] = None


def get_job_service() -> JobService:
    global _job_service
    if _job_service is None:
        _job_service = JobService()
    return _job_service
