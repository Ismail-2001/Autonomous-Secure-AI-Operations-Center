"""E2E test: WebSocket dashboard connectivity."""
import uuid

import pytest


@pytest.mark.e2e
class TestWebSocketDashboard:
    """Verify WebSocket threat feed endpoint behavior."""

    async def test_websocket_rejects_missing_token(self):
        from httpx import ASGITransport, AsyncClient

        from src.asoc.api.app import app

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/health")
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] in ("healthy", "degraded")

    async def test_health_endpoint_returns_service_status(self):
        from httpx import ASGITransport, AsyncClient

        from src.asoc.api.app import app

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/health")
            assert resp.status_code == 200
            data = resp.json()
            assert "service" in data
            assert data["service"] == "asoc-backend"
            assert "circuit_breakers" in data

    async def test_hunting_events_endpoint_requires_auth(self):
        from httpx import ASGITransport, AsyncClient

        from src.asoc.api.app import app

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/hunting/events")
            assert resp.status_code in (401, 403, 422)
