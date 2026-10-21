import asyncio
import hashlib
import hmac
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.asoc.core.connection import get_db_pool
from src.asoc.core.logging import get_incident_id, get_logger, get_trace_id

logger = get_logger("asoc.event_store")


class EventStore:
    def __init__(self, storage_path: str = "data/events.jsonl"):
        self.storage_path = Path(storage_path)
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = asyncio.Lock()
        hmac_secret = os.getenv("HMAC_SECRET")
        if not hmac_secret:
            raise ValueError("HMAC_SECRET environment variable must be set")
        self._hmac_key = hmac_secret.encode()
        self._chain_hash = self._load_last_hash()

    def _load_last_hash(self) -> str:
        if not self.storage_path.exists():
            return ""
        try:
            with open(self.storage_path, "r") as f:
                lines = f.readlines()
            if lines:
                last = json.loads(lines[-1].strip())
                return last.get("_chain_hash", "")
        except Exception:
            pass
        return ""

    def _hash_record(self, record: dict) -> str:
        serialized = json.dumps(record, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode()).hexdigest()

    def _sign_event(self, payload: dict, previous_hash: str = "") -> str:
        to_sign = {"payload": payload, "previous_hash": previous_hash}
        serialized = json.dumps(to_sign, sort_keys=True)
        return hmac.new(self._hmac_key, serialized.encode(), hashlib.sha256).hexdigest()

    def verify_event(self, event_record: dict, previous_hash: str = "") -> bool:
        signature = event_record.pop("signature", "")
        expected = self._sign_event(event_record.get("payload", {}), previous_hash)
        event_record["signature"] = signature
        return hmac.compare_digest(signature, expected)

    def verify_chain(self) -> bool:
        if not self.storage_path.exists():
            return True
        try:
            with open(self.storage_path, "r") as f:
                content = f.read()
            prev_hash = ""
            for line in content.strip().split("\n"):
                if not line:
                    continue
                record = json.loads(line)
                stored_sig = record.get("signature", "")
                expected_sig = self._sign_event(record.get("payload", {}), prev_hash)
                if not hmac.compare_digest(stored_sig, expected_sig):
                    return False
                prev_hash = record.get("_chain_hash", "")
            return True
        except Exception:
            return False

    async def append_event(self, event_type: str, payload: Dict[str, Any], agent: str):
        event_record = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "type": event_type,
            "agent": agent,
            "payload": payload,
            "signature": self._sign_event(payload, self._chain_hash),
        }
        event_record["_chain_hash"] = self._hash_record(event_record)
        async with self._lock:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, self._append_to_file, event_record)
            self._chain_hash = event_record["_chain_hash"]
        return event_record

    def _append_to_file(self, record: dict) -> None:
        with open(self.storage_path, "a") as f:
            f.write(json.dumps(record) + "\n")

    async def get_recent_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        if not self.storage_path.exists():
            return []
        try:
            loop = asyncio.get_running_loop()
            content = await loop.run_in_executor(None, self.storage_path.read_text)
            lines = content.strip().split("\n")
            events = []
            for line in reversed(lines[-limit:]):
                if line:
                    events.append(json.loads(line))
            return events
        except Exception as e:
            logger.error("Error reading event store: %s", e)
        return []

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
        if not self.storage_path.exists():
            return {"events": [], "total": 0, "limit": limit, "offset": offset}
        try:
            loop = asyncio.get_running_loop()
            content = await loop.run_in_executor(None, self.storage_path.read_text)
            lines = content.strip().split("\n")
            events = []
            for line in lines:
                if not line:
                    continue
                event = json.loads(line)
                if query and query.lower() not in json.dumps(event).lower():
                    continue
                if agent and agent.lower() not in event.get("agent", "").lower():
                    continue
                if event_type and event_type.lower() not in event.get("type", "").lower():
                    continue
                if start_time and event.get("timestamp", "") < start_time:
                    continue
                if end_time and event.get("timestamp", "") > end_time:
                    continue
                events.append(event)
            events.reverse()
            total = len(events)
            sliced = events[offset : offset + limit]
            return {"events": sliced, "total": total, "limit": limit, "offset": offset}
        except Exception as e:
            logger.error("Error searching event store: %s", e)
            return {"events": [], "total": 0, "limit": limit, "offset": offset}

    async def get_timeline(
        self, query: str = "", agent: str = "", start_time: str = "", end_time: str = "", bucket: str = "hour"
    ) -> List[Dict[str, Any]]:
        from collections import defaultdict

        result = await self.search_events(
            query=query, agent=agent, start_time=start_time, end_time=end_time, limit=10000
        )
        events = result["events"]
        buckets: Dict[str, int] = defaultdict(int)
        for event in events:
            ts = event.get("timestamp", "")
            if not ts:
                continue
            if bucket == "hour":
                key = ts[:13] + ":00:00"
            elif bucket == "day":
                key = ts[:10] + "T00:00:00"
            elif bucket == "minute":
                key = ts[:16] + ":00"
            else:
                key = ts[:13] + ":00:00"
            buckets[key] += 1
        return [{"time": k, "count": v} for k, v in sorted(buckets.items())]


class PostgresEventStore:
    def __init__(self) -> None:
        hmac_secret = os.getenv("HMAC_SECRET")
        if not hmac_secret:
            raise ValueError("HMAC_SECRET environment variable must be set")
        self._hmac_key = hmac_secret.encode()

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
                json.dumps(payload),
                signature,
                get_trace_id(),
                get_incident_id(),
            )
        return {
            "id": event_id,
            "timestamp": now.isoformat(),
            "type": event_type,
            "agent": agent,
            "payload": payload,
            "signature": signature,
        }

    async def get_recent_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        pool = await get_db_pool()
        async with pool.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT id, timestamp, event_type, agent, payload, signature FROM events ORDER BY timestamp DESC LIMIT $1",
                limit,
            )
        return [
            {
                "id": str(r["id"]),
                "timestamp": r["timestamp"].isoformat(),
                "type": r["event_type"],
                "agent": r["agent"],
                "payload": r["payload"],
                "signature": r["signature"],
            }
            for r in rows
        ]

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

        if query:
            conditions.append(f"payload::text ILIKE ${idx}")
            params.append(f"%{query}%")
            idx += 1
        if agent:
            conditions.append(f"agent ILIKE ${idx}")
            params.append(f"%{agent}%")
            idx += 1
        if event_type:
            conditions.append(f"event_type ILIKE ${idx}")
            params.append(f"%{event_type}%")
            idx += 1
        if start_time:
            conditions.append(f"timestamp >= ${idx}::timestamptz")
            params.append(start_time)
            idx += 1
        if end_time:
            conditions.append(f"timestamp <= ${idx}::timestamptz")
            params.append(end_time)
            idx += 1

        where = " WHERE " + " AND ".join(conditions) if conditions else ""

        async with pool.pool.acquire() as conn:
            count_row = await conn.fetchval(f"SELECT COUNT(*) FROM events{where}", *params)
            total = count_row or 0
            rows = await conn.fetch(
                f"SELECT id, timestamp, event_type, agent, payload, signature FROM events{where} ORDER BY timestamp DESC LIMIT ${idx} OFFSET ${idx + 1}",
                *params,
                limit,
                offset,
            )
        return {
            "events": [
                {
                    "id": str(r["id"]),
                    "timestamp": r["timestamp"].isoformat(),
                    "type": r["event_type"],
                    "agent": r["agent"],
                    "payload": r["payload"],
                    "signature": r["signature"],
                }
                for r in rows
            ],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    async def get_timeline(
        self, query: str = "", agent: str = "", start_time: str = "", end_time: str = "", bucket: str = "hour"
    ) -> List[Dict[str, Any]]:
        pool = await get_db_pool()
        trunc = "hour" if bucket == "hour" else "day" if bucket == "day" else "minute"
        conditions: List[str] = []
        params: List[Any] = []
        idx = 1

        if query:
            conditions.append(f"payload::text ILIKE ${idx}")
            params.append(f"%{query}%")
            idx += 1
        if agent:
            conditions.append(f"agent ILIKE ${idx}")
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

        where = " WHERE " + " AND ".join(conditions) if conditions else ""

        async with pool.pool.acquire() as conn:
            rows = await conn.fetch(
                f"""
                SELECT date_trunc($${idx}, timestamp) AS time_bucket, COUNT(*) AS count
                FROM events{where}
                GROUP BY time_bucket
                ORDER BY time_bucket ASC
                """,
                trunc,
                *params,
            )
        return [{"time": r["time_bucket"].isoformat(), "count": r["count"]} for r in rows]
