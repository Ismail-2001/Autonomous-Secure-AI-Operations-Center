from typing import Any, Optional

from fastapi import Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from src.asoc.core.jwt_handler import Role, TokenPayload, require_role
from src.asoc.core.job_service import Job, JobState, get_job_service
from . import router


class EnqueueJobRequest(BaseModel):
    incident_id: str
    max_attempts: int = Field(default=3, ge=1, le=10)
    state_payload: dict[str, Any] = Field(default_factory=dict)


class CancelJobRequest(BaseModel):
    reason: str = Field(default="Cancelled by supervisor")


@router.get("/jobs", response_model=list[Job])
async def list_jobs(
    incident_id: Optional[str] = Query(None, description="Filter by incident ID"),
    state: Optional[JobState] = Query(None, description="Filter by job state"),
    limit: int = Query(50, ge=1, le=100),
    current_user: TokenPayload = Depends(require_role(Role.ANALYST)),
):
    """List jobs with optional filters (Analyst or above)."""
    service = get_job_service()
    return await service.list_jobs(incident_id=incident_id, state=state, limit=limit)


@router.get("/{job_id}", response_model=Job)
async def get_job(
    job_id: str,
    current_user: TokenPayload = Depends(require_role(Role.ANALYST)),
):
    """Get details for a specific job (Analyst or above)."""
    service = get_job_service()
    job = await service.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )
    return job


@router.post("/enqueue", response_model=Job, status_code=status.HTTP_201_CREATED)
async def enqueue_job(
    request: EnqueueJobRequest,
    current_user: TokenPayload = Depends(require_role(Role.ANALYST)),
):
    """Enqueue an incident investigation workflow job (Analyst or above)."""
    service = get_job_service()
    return await service.enqueue_job(
        incident_id=request.incident_id,
        max_attempts=request.max_attempts,
        state_payload=request.state_payload,
    )


@router.post("/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    request: CancelJobRequest,
    current_user: TokenPayload = Depends(require_role(Role.SUPERVISOR)),
):
    """Cancel a pending or running job (Supervisor or above)."""
    service = get_job_service()
    job = await service.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )

    if job.state in (JobState.COMPLETED, JobState.FAILED, JobState.CANCELLED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel job in terminal state '{job.state.value}'",
        )

    success = await service.cancel_job(job_id, reason=request.reason)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel job",
        )

    return {
        "job_id": job_id,
        "status": "cancelled",
        "reason": request.reason,
        "cancelled_by": current_user.sub,
    }
