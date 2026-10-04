import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

# Suppress deprecation warnings during tests
os.environ["PYTHONWARNINGS"] = "ignore::DeprecationWarning"

# Set test environment variables
os.environ["WS_API_TOKEN"] = "test-token"
os.environ["HMAC_SECRET"] = "test-hmac-secret-for-integration-tests"


@pytest.fixture
def setup_test_state():
    """Factory that builds a fresh AgentState seeded with an incident id."""
    from src.asoc.agents.state import AgentState, create_initial_state

    def _make(incident_id: str) -> AgentState:
        state = create_initial_state()
        state["incident_id"] = incident_id
        return state

    return _make


@pytest.fixture
def auth_headers():
    """Authorization header carrying a locally issued RS256 access token."""
    from src.asoc.core.jwt_handler import Role, create_token_pair

    pair = create_token_pair(user_id="perf-user", role=Role.ADMIN)
    return {"Authorization": f"Bearer {pair.access_token}"}


@pytest.fixture
async def http_client():
    """HTTP client against a running backend; skips the test when it is down."""
    import httpx

    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            resp = await client.get("http://localhost:9002/health")
        except httpx.HTTPError:
            pytest.skip("backend not running on localhost:9002")
        if resp.status_code != 200:
            pytest.skip("backend health check failed")
        yield client
