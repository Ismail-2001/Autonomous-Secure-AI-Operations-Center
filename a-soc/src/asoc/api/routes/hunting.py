"""Threat hunting and event search routes."""

from fastapi import Depends, Query

from src.asoc.core.auth import require_jwt
from src.asoc.core.rate_limiter import check_rate_limit

from . import router, get_event_store


@router.get("/hunting/events", dependencies=[Depends(require_jwt), Depends(check_rate_limit)])
async def hunting_events(
    q: str = Query(default="", max_length=500),
    source: str = Query(default="", max_length=100, alias="agent"),
    event_type: str = Query(default="", max_length=50),
    start_time: str = Query(default="", max_length=30),
    end_time: str = Query(default="", max_length=30),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    result = await get_event_store().search_events(
        query=q,
        agent=source,
        event_type=event_type,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
        offset=offset,
    )
    return {"status": "ok", **result}


@router.get("/hunting/timeline", dependencies=[Depends(require_jwt), Depends(check_rate_limit)])
async def hunting_timeline(
    q: str = Query(default="", max_length=500),
    source: str = Query(default="", max_length=100, alias="agent"),
    start_time: str = Query(default="", max_length=30),
    end_time: str = Query(default="", max_length=30),
    bucket: str = Query(default="hour", pattern="^(minute|hour|day)$"),
):
    buckets = await get_event_store().get_timeline(
        query=q,
        agent=source,
        start_time=start_time,
        end_time=end_time,
        bucket=bucket,
    )
    return {"status": "ok", "buckets": buckets, "bucket_size": bucket}
