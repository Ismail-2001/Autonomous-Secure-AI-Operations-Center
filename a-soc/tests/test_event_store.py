import pytest

from core.memory.event_store import EventStore


@pytest.mark.asyncio
async def test_append_and_retrieve():
    store = EventStore(storage_path="/tmp/test_events.jsonl")
    record = await store.append_event("test", {"key": "val"}, "TestAgent")
    assert record["type"] == "test"
    assert record["agent"] == "TestAgent"
    assert record["payload"] == {"key": "val"}
    events = await store.get_recent_events(limit=10)
    assert len(events) >= 1


@pytest.mark.asyncio
async def test_empty_store():
    store = EventStore(storage_path="/tmp/nonexistent_events.jsonl")
    events = await store.get_recent_events()
    assert events == []


@pytest.mark.asyncio
async def test_event_id_uniqueness():
    store = EventStore(storage_path="/tmp/test_unique.jsonl")
    r1 = await store.append_event("a", {}, "Agent1")
    r2 = await store.append_event("b", {}, "Agent2")
    assert r1["id"] != r2["id"]
