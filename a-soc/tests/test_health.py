import os

import pytest
from httpx import ASGITransport, AsyncClient

from api import app

transport = ASGITransport(app=app)


@pytest.mark.asyncio
async def test_health_returns_200():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["service"] == "asoc-backend"
        assert "active_connections" in data


@pytest.mark.asyncio
async def test_health_returns_valid_json():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.headers["content-type"] == "application/json"


@pytest.mark.asyncio
async def test_hunting_events_needs_auth():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/hunting/events")
        assert resp.status_code == 401
        data = resp.json()
        assert "error" in data


@pytest.mark.asyncio
async def test_hunting_with_auth():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = os.environ.get("WS_API_TOKEN", "test-token")
        resp = await client.get("/api/hunting/events", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_structured_error_on_404():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/nonexistent")
        assert resp.status_code == 404
        # FastAPI default 404 format
        data = resp.json()
        assert "detail" in data


@pytest.mark.asyncio
async def test_request_id_header_returned():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert "x-request-id" in resp.headers


@pytest.mark.asyncio
async def test_request_id_passthrough():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health", headers={"X-Request-ID": "my-rid"})
        assert resp.headers.get("x-request-id") == "my-rid"
