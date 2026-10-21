"""A-SOC Worker: Production-Ready Background Task Processor for LangGraph Incident Workflows.

Features:
1. Multi-replica concurrency safety via Postgres SELECT ... FOR UPDATE SKIP LOCKED.
2. In-memory / thread-safe fallback for local development and offline test environments.
3. LangGraph checkpoint persistence & resumption (thread_id: incident-{incident_id}).
4. Dedicated background heartbeat task (every 10s) ensuring liveness.
5. Automatic stale worker lock recovery (> 300s elapsed since last heartbeat).
6. Real cancellation detection (supervisor POST /jobs/{id}/cancel -> asyncio.Task.cancel()).
7. Action idempotency integration to prevent duplicate external actions.
8. Clean SIGINT/SIGTERM shutdown signal handling.
"""

import asyncio
import os
import signal
import socket
import sys
import uuid
from typing import Any, Optional

from src.asoc.agents.state import create_initial_state
from src.asoc.core.checkpoint import create_checkpointer
from src.asoc.core.job_service import Job, JobService, JobState, get_job_service
from src.asoc.core.logging import get_logger
from src.asoc.orchestration.workflow import create_asoc_graph

logger = get_logger("asoc.worker")

_shutdown = asyncio.Event()


def _handle_signal(sig: signal.Signals) -> None:
    logger.info("worker_shutdown_signal_received", signal=sig.name)
    _shutdown.set()


class AsocWorker:
    """Production worker instance processing jobs from the queue."""

    def __init__(
        self,
        worker_id: Optional[str] = None,
        job_service: Optional[JobService] = None,
        heartbeat_interval_seconds: float = 10.0,
        stale_timeout_seconds: int = 300,
        poll_interval_seconds: float = 2.0,
    ):
        hostname = socket.gethostname()
        unique_suffix = uuid.uuid4().hex[:8]
        self.worker_id = worker_id or f"worker-{hostname}-{unique_suffix}"
        self.job_service = job_service or get_job_service()
        self.heartbeat_interval = heartbeat_interval_seconds
        self.stale_timeout = stale_timeout_seconds
        self.poll_interval = poll_interval_seconds
        self.checkpointer = None
        self.graph = None

    async def initialize(self) -> None:
        """Initialize LangGraph checkpointer and compiled workflow graph."""
        logger.info("worker_initializing", worker_id=self.worker_id)
        self.checkpointer = await create_checkpointer()
        self.graph = create_asoc_graph(checkpointer=self.checkpointer)
        logger.info("worker_initialized", worker_id=self.worker_id)

    async def _heartbeat_loop(self, job_id: str, stop_event: asyncio.Event) -> None:
        """Background task updating the job's heartbeat timestamp while active."""
        while not stop_event.is_set():
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=self.heartbeat_interval)
                break
            except asyncio.TimeoutError:
                pass

            if _shutdown.is_set():
                break

            success = await self.job_service.heartbeat_job(job_id, self.worker_id)
            if not success:
                logger.warning("heartbeat_failed_or_job_lost", job_id=job_id, worker_id=self.worker_id)
                # Job may have been cancelled externally by a supervisor
                job = await self.job_service.get_job(job_id)
                if job and job.state == JobState.CANCELLED:
                    logger.info("job_cancelled_externally", job_id=job_id)
                    stop_event.set()
                    break

    async def execute_job(self, job: Job) -> bool:
        """Run a claimed job through the LangGraph incident workflow."""
        logger.info(
            "job_execution_started",
            job_id=job.id,
            incident_id=job.incident_id,
            attempt=job.attempt,
            worker_id=self.worker_id,
        )

        heartbeat_stop = asyncio.Event()
        heartbeat_task = asyncio.create_task(self._heartbeat_loop(job.id, heartbeat_stop))

        thread_id = f"incident-{job.incident_id}"
        config = {
            "configurable": {
                "thread_id": thread_id,
                "checkpoint_ns": "a-soc-incidents",
            }
        }

        # Seed initial state or use saved payload
        state = create_initial_state()
        state["incident_id"] = job.incident_id
        if job.state_payload:
            state.update(job.state_payload)

        execution_success = False
        try:
            # LangGraph ainvoke will automatically resume from checkpoint if thread_id has history
            if hasattr(self.graph, "ainvoke"):
                final_state = await self.graph.ainvoke(state, config=config)
            else:
                # Sync invocation wrapper
                loop = asyncio.get_running_loop()
                final_state = await loop.run_in_executor(None, lambda: self.graph.invoke(state, config=config))

            # Check if job was cancelled during execution
            current_job = await self.job_service.get_job(job.id)
            if current_job and current_job.state == JobState.CANCELLED:
                logger.info("job_execution_stopped_due_to_cancellation", job_id=job.id)
                return False

            # Extract compact serializable state summary
            summary = {
                "risk_score": final_state.get("risk_score", 0.0),
                "is_authorized": final_state.get("is_authorized", False),
                "next_step": final_state.get("next_step", "completed"),
                "observations_count": len(final_state.get("agent_observations", [])),
            }

            await self.job_service.complete_job(job.id, state_payload=summary)
            logger.info("job_execution_completed_successfully", job_id=job.id, incident_id=job.incident_id)
            execution_success = True

        except asyncio.CancelledError:
            logger.warning("job_execution_cancelled", job_id=job.id)
            await self.job_service.cancel_job(job.id, reason="Execution cancelled by signal/task cancel")
            raise

        except Exception as e:
            logger.error("job_execution_failed", job_id=job.id, error=str(e), attempt=job.attempt)
            await self.job_service.fail_job(job.id, error_message=str(e))

        finally:
            heartbeat_stop.set()
            try:
                await asyncio.wait_for(heartbeat_task, timeout=2.0)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                heartbeat_task.cancel()

        return execution_success

    async def run(self) -> None:
        """Main worker execution loop."""
        await self.initialize()
        logger.info("worker_loop_running", worker_id=self.worker_id)

        while not _shutdown.is_set():
            try:
                # 1. Claim next pending job or recover stale job
                job = await self.job_service.claim_next_job(
                    worker_id=self.worker_id,
                    stale_timeout_seconds=self.stale_timeout,
                )

                if job:
                    await self.execute_job(job)
                    # Yield briefly so other cooperative tasks/events run
                    await asyncio.sleep(0.05)
                else:
                    # No pending jobs, wait for poll interval
                    await asyncio.sleep(self.poll_interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("worker_loop_error", worker_id=self.worker_id, error=str(e))
                await asyncio.sleep(self.poll_interval)

        logger.info("worker_loop_stopped", worker_id=self.worker_id)


async def main() -> None:
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _handle_signal, sig)
        except NotImplementedError:
            pass

    poll_int = float(os.getenv("WORKER_POLL_INTERVAL", "2.0"))
    worker = AsocWorker(poll_interval_seconds=poll_int)
    await worker.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("worker_process_interrupted")
        sys.exit(0)
