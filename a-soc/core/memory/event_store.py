import asyncio
import hashlib
import hmac
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


class EventStore:
    def __init__(self, storage_path: str = "data/events.jsonl"):
        self.storage_path = Path(storage_path)
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = asyncio.Lock()
        self._hmac_key = os.getenv("HMAC_SECRET", "").encode() or b"dev-secret-change-in-prod"

    def _sign_event(self, payload: dict) -> str:
        serialized = json.dumps(payload, sort_keys=True)
        return hmac.new(self._hmac_key, serialized.encode(), hashlib.sha256).hexdigest()

    def verify_event(self, event_record: dict) -> bool:
        signature = event_record.pop("signature", "")
        expected = self._sign_event(event_record.get("payload", {}))
        event_record["signature"] = signature
        return hmac.compare_digest(signature, expected)

    async def append_event(self, event_type: str, payload: Dict[str, Any], agent: str):
        """Append an event to the immutable log with HMAC signature."""
        event_record = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "type": event_type,
            "agent": agent,
            "payload": payload,
            "signature": self._sign_event(payload),
        }

        async with self._lock:
            import aiofiles

            async with aiofiles.open(self.storage_path, "a") as f:
                await f.write(json.dumps(event_record) + "\n")

        return event_record

    async def get_recent_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieve recent events from the log."""
        if not self.storage_path.exists():
            return []

        try:
            import aiofiles

            async with aiofiles.open(self.storage_path, "r") as f:
                content = await f.read()
            lines = content.strip().split("\n")
            events = []
            for line in reversed(lines[-limit:]):
                if line:
                    events.append(json.loads(line))
            return events
        except Exception as e:
            print(f"Error reading event store: {e}")

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
            import aiofiles

            async with aiofiles.open(self.storage_path, "r") as f:
                content = await f.read()
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
            print(f"Error searching event store: {e}")
            return {"events": [], "total": 0, "limit": limit, "offset": offset}

    async def get_timeline(
        self,
        query: str = "",
        agent: str = "",
        start_time: str = "",
        end_time: str = "",
        bucket: str = "hour",
    ) -> List[Dict[str, Any]]:
        from collections import defaultdict

        result = await self.search_events(query=query, agent=agent, start_time=start_time, end_time=end_time, limit=10000)
        events = result["events"]

        buckets: Dict[str, int] = defaultdict(int)
        for event in events:
            ts = event.get("timestamp", "")
            if not ts:
                continue
            if bucket == "hour":
                key = ts[:13] + ":00:00"  # 2026-06-05T12:00:00 -> 2026-06-05T12:00:00
            elif bucket == "day":
                key = ts[:10] + "T00:00:00"
            elif bucket == "minute":
                key = ts[:16] + ":00"
            else:
                key = ts[:13] + ":00:00"
            buckets[key] += 1

        sorted_buckets = [{"time": k, "count": v} for k, v in sorted(buckets.items())]
        return sorted_buckets


# Singleton instance
event_store = EventStore()
