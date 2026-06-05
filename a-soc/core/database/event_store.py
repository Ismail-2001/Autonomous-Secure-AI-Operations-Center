import hashlib
import hmac
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from core.database.connection import get_db_pool
from core.logging import get_incident_id, get_logger, get_trace_id

logger = get_logger("asoc.event_store")


class PostgresEventStore:
    def __init__(self) -> None:
        self._hmac_key = os.getenv("HMAC_SECRET", "").encode() or b"dev-secret-change-in-prod"

    def _sign_payload(self, payload: dict) -> str:
        serialized = str(sorted(payload.items()))
        return hmac.new(self._hmac_key, serialized.encode(), hashlib.sha256).hexdigest()

    async def append_event(self, event_type: str, payload: Dict[str, Any], agent: str) -> Dict[str, Any]:
        event_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        signature = self._sign_payload(payload)
        pool = await get_db_pool()
        async with pool.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO events (id, timestamp, event_type, agent, payload, signature, trace_id, incident_id)
                VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
                """,
                event_id,
                now,
                event_type,
                agent,
                payload,
                signature,
                get_trace_id(),
                get_incident_id(),
            )
        logger.info("event_appended", event_id=event_id, event_type=event_type, agent=agent)
        return {
            "id": event_id,
            "timestamp": now.isoformat(),
            "type": event_type,
            "agent": agent,
            "payload": payload,
            "signature": signature,
        }

    async def search_events(
        self,
        query: str = "",
        agent: str = "",
        event_type: str = "",
        start_time: str = "",
        end_time: str = "",
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        pool = await get_db_pool()
        conditions: List[str] = []
        params: List[Any] = []
        idx = 1

        if agent:
            conditions.append(f"agent ILIKE ${idx}::text")
            params.append(f"%{agent}%")
            idx += 1
        if event_type:
            conditions.append(f"event_type = ${idx}::text")
            params.append(event_type)
            idx += 1
        if start_time:
            conditions.append(f"timestamp >= ${idx}::timestamptz")
            params.append(start_time)
            idx += 1
        if end_time:
            conditions.append(f"timestamp <= ${idx}::timestamptz")
            params.append(end_time)
            idx += 1
        if query:
            conditions.append(f"payload::text ILIKE ${idx}::text")
            params.append(f"%{query}%")
            idx += 1

        where_clause = " AND ".join(conditions) if conditions else "TRUE"

        async with pool.pool.acquire() as conn:
            count_row = await conn.fetchval(f"SELECT COUNT(*) FROM events WHERE {where_clause}", *params)
            total = count_row or 0

            rows = await conn.fetch(
                f"""
                SELECT id, timestamp, event_type, agent, payload, signature, trace_id, incident_id
                FROM events WHERE {where_clause}
                ORDER BY timestamp DESC LIMIT ${idx} OFFSET ${idx+1}
                """,
                *params,
                limit,
                offset,
            )

        events = []
        for row in rows:
            events.append(
                {
                    "id": str(row["id"]),
                    "timestamp": row["timestamp"].isoformat(),
                    "type": row["event_type"],
                    "agent": row["agent"],
                    "payload": row["payload"],
                    "signature": row["signature"],
                }
            )

        return {"events": events, "total": total, "limit": limit, "offset": offset}

    async def get_timeline(
        self,
        query: str = "",
        agent: str = "",
        start_time: str = "",
        end_time: str = "",
        bucket: str = "hour",
    ) -> List[Dict[str, Any]]:
        bucket_expr = {
            "minute": "date_trunc('minute', timestamp)",
            "hour": "date_trunc('hour', timestamp)",
            "day": "date_trunc('day', timestamp)",
        }.get(bucket, "date_trunc('hour', timestamp)")

        pool = await get_db_pool()
        conditions: List[str] = []
        params: List[Any] = []
        idx = 1

        if agent:
            conditions.append(f"agent ILIKE ${idx}::text")
            params.append(f"%{agent}%")
            idx += 1
        if start_time:
            conditions.append(f"timestamp >= ${idx}::timestamptz")
            params.append(start_time)
            idx += 1
        if end_time:
            conditions.append(f"timestamp <= ${idx}::timestamptz")
            params.append(end_time)
            idx += 1
        if query:
            conditions.append(f"payload::text ILIKE ${idx}::text")
            params.append(f"%{query}%")
            idx += 1

        where_clause = " AND ".join(conditions) if conditions else "TRUE"

        async with pool.pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT {bucket_expr} AS bucket, COUNT(*) AS count
                FROM events WHERE {where_clause}
                GROUP BY bucket ORDER BY bucket
                """,
                *params,
            )

        return [{"time": row["bucket"].isoformat(), "count": row["count"]} for row in rows]
