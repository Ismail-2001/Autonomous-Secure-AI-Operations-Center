import pytest
from httpx import AsyncClient, ASGITransport
from api import app

transport = ASGITransport(app=app)

@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert data["service"] == "asoc-backend"
        assert "active_connections" in data

@pytest.mark.asyncio
async def test_health_returns_valid_json():
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.headers["content-type"] == "application/json"
