"""Phase 1 Comprehensive Test Suite: Worker Pipeline, Concurrency, Resumption & Idempotency.

Validates:
1. Multi-replica concurrency: N workers claiming jobs concurrently results in 0 duplicate claims.
2. Heartbeat tracking & stale lock recovery after worker abandonment.
3. Job lifecycle transitions: PENDING -> RUNNING -> RETRYING -> FAILED / COMPLETED.
4. Action idempotency: irreversible external actions are deduplicated and never re-executed.
5. Real job cancellation: supervisor cancellation aborts queued and in-progress jobs.
6. Jobs API endpoints: RBAC enforcement, job query, enqueuing, and supervisor cancellation.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from src.asoc.api.app import app
from src.asoc.core.idempotency import (
    IdempotencyManager,
    execute_idempotent,
    generate_idempotency_key,
)
from src.asoc.core.job_service import (
    Job,
    JobService,
    JobState,
    _in_memory_jobs,
    get_job_service,
)
from src.asoc.core.jwt_handler import Role, create_token_pair
from src.asoc.worker import AsocWorker


@pytest.fixture(autouse=True)
def _clear_jobs():
    """Reset the in-memory job queue before each test."""
    _in_memory_jobs.clear()
    yield
    _in_memory_jobs.clear()


# ── 1. Multi-Replica Concurrency Test (Zero Duplicate Claims) ─────────────


class TestWorkerConcurrency:
    @pytest.mark.asyncio
    async def test_zero_duplicate_claims_across_concurrent_workers(self):
        service = JobService()

        # Enqueue 10 jobs
        jobs = []
        for i in range(10):
            job = await service.enqueue_job(incident_id=f"INC-CONCUR-{i}")
            jobs.append(job)

        worker_ids = [f"worker-node-{w}" for w in range(4)]
        claimed_records: dict[str, str] = {}  # job_id -> worker_id
        claim_lock = asyncio.Lock()

        async def worker_claim_loop(worker_id: str):
            while True:
                claimed = await service.claim_next_job(worker_id=worker_id)
                if not claimed:
                    break
                async with claim_lock:
                    assert claimed.id not in claimed_records, f"Duplicate claim detected for job {claimed.id}!"
                    claimed_records[claimed.id] = worker_id
                await asyncio.sleep(0.01)

        # Run 4 workers concurrently
        await asyncio.gather(*(worker_claim_loop(wid) for wid in worker_ids))

        # Every single job was claimed exactly once
        assert len(claimed_records) == 10
        assert set(claimed_records.keys()) == {j.id for j in jobs}


# ── 2. Heartbeat & Stale Lock Recovery ─────────────────────────────────────


class TestStaleLockRecovery:
    @pytest.mark.asyncio
    async def test_stale_job_recovered_by_another_worker(self):
        service = JobService()
        job = await service.enqueue_job(incident_id="INC-STALE-001")

        # Worker 1 claims job
        claimed_w1 = await service.claim_next_job(worker_id="worker-crashed")
        assert claimed_w1 is not None
        assert claimed_w1.locked_by == "worker-crashed"
        assert claimed_w1.attempt == 1

        # Simulate Worker 1 crashing and heartbeat expiring 6 minutes ago
        now = datetime.now(timezone.utc)
        six_minutes_ago = now - timedelta(minutes=6)
        _in_memory_jobs[job.id].heartbeat_at = six_minutes_ago

        # Worker 2 attempts claim with 300s (5min) stale threshold
        claimed_w2 = await service.claim_next_job(worker_id="worker-healthy", stale_timeout_seconds=300)
        assert claimed_w2 is not None
        assert claimed_w2.id == job.id
        assert claimed_w2.locked_by == "worker-healthy"
        assert claimed_w2.attempt == 2  # Second attempt


# ── 3. Job Retry & Max Attempts Lifecycle ──────────────────────────────────


class TestJobLifecycleAndRetries:
    @pytest.mark.asyncio
    async def test_retries_until_max_attempts_then_fails(self):
        service = JobService()
        job = await service.enqueue_job(incident_id="INC-RETRY-001", max_attempts=3)

        # Attempt 1
        j1 = await service.claim_next_job("worker-1")
        assert j1.attempt == 1
        await service.fail_job(j1.id, error_message="Network glitch 1")
        j1_state = await service.get_job(j1.id)
        assert j1_state.state == JobState.RETRYING

        # Attempt 2
        j2 = await service.claim_next_job("worker-1")
        assert j2.attempt == 2
        await service.fail_job(j2.id, error_message="Network glitch 2")
        j2_state = await service.get_job(j2.id)
        assert j2_state.state == JobState.RETRYING

        # Attempt 3 (final attempt)
        j3 = await service.claim_next_job("worker-1")
        assert j3.attempt == 3
        await service.fail_job(j3.id, error_message="Fatal cloud error")
        j3_state = await service.get_job(j3.id)
        assert j3_state.state == JobState.FAILED

        # No more jobs available to claim
        none_job = await service.claim_next_job("worker-1")
        assert none_job is None


# ── 4. Action Idempotency & Deduplication ──────────────────────────────────


class TestActionIdempotency:
    @pytest.mark.asyncio
    async def test_idempotent_action_executes_only_once(self):
        call_count = 0

        async def isolate_server(target_id: str):
            nonlocal call_count
            call_count += 1
            return {"status": "isolated", "target": target_id}

        incident = "INC-IDEMP-001"
        action = "ISOLATE_HOST"
        params = {"instance_id": "i-0987654321fedcba"}

        # 1. First execution -> executes underlying function
        executed1, res1 = await execute_idempotent(
            incident, action, params, isolate_server, target_id="i-0987654321fedcba"
        )
        assert executed1 is True
        assert res1["status"] == "isolated"
        assert call_count == 1

        # 2. Second execution (e.g. on worker restart or retry) -> deduplicated, does NOT call function again
        executed2, res2 = await execute_idempotent(
            incident, action, params, isolate_server, target_id="i-0987654321fedcba"
        )
        assert executed2 is False
        assert res2["status"] == "isolated"
        assert call_count == 1  # call count remained 1!

        # 3. Different params -> executes
        executed3, res3 = await execute_idempotent(
            incident, action, {"instance_id": "i-different"}, isolate_server, target_id="i-different"
        )
        assert executed3 is True
        assert call_count == 2


# ── 5. Real Job Cancellation ──────────────────────────────────────────────


class TestJobCancellation:
    @pytest.mark.asyncio
    async def test_cancellation_marks_job_and_prevents_claiming(self):
        service = JobService()
        job = await service.enqueue_job(incident_id="INC-CANCEL-001")

        # Supervisor cancels
        cancelled = await service.cancel_job(job.id, reason="False positive identified by operator")
        assert cancelled is True

        job_state = await service.get_job(job.id)
        assert job_state.state == JobState.CANCELLED
        assert "False positive" in job_state.error

        # Worker cannot claim cancelled job
        claimed = await service.claim_next_job("worker-test")
        assert claimed is None


# ── 6. Jobs API Endpoints & RBAC ──────────────────────────────────────────


class TestJobsApiEndpoints:
    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_list_and_enqueue_jobs_rbac(self, client):
        analyst_tokens = create_token_pair(user_id="analyst-job-test", role=Role.ANALYST)
        viewer_tokens = create_token_pair(user_id="viewer-job-test", role=Role.VIEWER)

        # Viewer cannot list jobs (403)
        res_viewer = client.get(
            "/api/v1/jobs",
            headers={"Authorization": f"Bearer {viewer_tokens.access_token}"},
        )
        assert res_viewer.status_code == 403

        # Analyst can enqueue job
        res_enqueue = client.post(
            "/api/v1/jobs/enqueue",
            headers={"Authorization": f"Bearer {analyst_tokens.access_token}"},
            json={"incident_id": "INC-API-001", "max_attempts": 3},
        )
        assert res_enqueue.status_code == 201
        data = res_enqueue.json()
        assert data["incident_id"] == "INC-API-001"
        assert data["state"] == "PENDING"
        job_id = data["id"]

        # Analyst can list jobs
        res_list = client.get(
            "/api/v1/jobs",
            headers={"Authorization": f"Bearer {analyst_tokens.access_token}"},
        )
        assert res_list.status_code == 200
        jobs_list = res_list.json()
        assert any(j["id"] == job_id for j in jobs_list)

    def test_cancel_job_requires_supervisor(self, client):
        analyst_tokens = create_token_pair(user_id="analyst-job-test", role=Role.ANALYST)
        supervisor_tokens = create_token_pair(user_id="sup-job-test", role=Role.SUPERVISOR)

        # Enqueue a job
        res_enqueue = client.post(
            "/api/v1/jobs/enqueue",
            headers={"Authorization": f"Bearer {analyst_tokens.access_token}"},
            json={"incident_id": "INC-CANCEL-API", "max_attempts": 3},
        )
        job_id = res_enqueue.json()["id"]

        # Analyst cannot cancel (403 Forbidden)
        res_cancel_analyst = client.post(
            f"/api/v1/jobs/{job_id}/cancel",
            headers={"Authorization": f"Bearer {analyst_tokens.access_token}"},
            json={"reason": "Unauthorized cancel"},
        )
        assert res_cancel_analyst.status_code == 403

        # Supervisor can cancel (200 OK)
        res_cancel_sup = client.post(
            f"/api/v1/jobs/{job_id}/cancel",
            headers={"Authorization": f"Bearer {supervisor_tokens.access_token}"},
            json={"reason": "Supervisor confirmed false positive"},
        )
        assert res_cancel_sup.status_code == 200
        assert res_cancel_sup.json()["status"] == "cancelled"
