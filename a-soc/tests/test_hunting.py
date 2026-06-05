import os

import pytest
from httpx import ASGITransport, AsyncClient

from api import app

transport = ASGITransport(app=app)


def _auth():
    return {"Authorization": f"Bearer {os.environ.get('WS_API_TOKEN', 'test-token')}"}


@pytest.mark.asyncio
async def test_hunting_events_returns_ok():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/hunting/events", headers=_auth())
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "events" in data
        assert "total" in data
        assert data["limit"] == 50
        assert data["offset"] == 0


@pytest.mark.asyncio
async def test_hunting_events_with_filters():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/hunting/events?q=login&limit=10&offset=0", headers=_auth())
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_hunting_events_invalid_limit():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/hunting/events?limit=1000", headers=_auth())
        assert resp.status_code in (200, 422)
        if resp.status_code == 422:
            data = resp.json()
            assert "detail" in data


@pytest.mark.asyncio
async def test_hunting_timeline_returns_ok():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/hunting/timeline", headers=_auth())
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "buckets" in data
        assert data["bucket_size"] == "hour"


@pytest.mark.asyncio
async def test_hunting_timeline_with_filters():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/hunting/timeline?bucket=day&q=test", headers=_auth())
        assert resp.status_code == 200
        data = resp.json()
        assert data["bucket_size"] == "day"


@pytest.mark.asyncio
async def test_hunting_timeline_invalid_bucket():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/hunting/timeline?bucket=year", headers=_auth())
        assert resp.status_code == 422
