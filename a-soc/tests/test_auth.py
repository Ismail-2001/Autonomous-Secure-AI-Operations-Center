from unittest.mock import patch

import pytest
from fastapi import HTTPException
from pydantic import SecretStr

from core.auth import require_api_token
from core.config import settings


@pytest.fixture(autouse=True)
def _auth_token():
    token = settings.WS_API_TOKEN
    settings.WS_API_TOKEN = SecretStr("test-token")
    yield
    settings.WS_API_TOKEN = token


@pytest.mark.asyncio
async def test_require_api_token_missing():
    with pytest.raises(HTTPException) as exc:
        await require_api_token(authorization=None, x_api_key=None)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_require_api_token_invalid():
    with pytest.raises(HTTPException) as exc:
        await require_api_token(authorization="Bearer wrong-token", x_api_key=None)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_require_api_token_valid_bearer():
    result = await require_api_token(authorization="Bearer test-token", x_api_key=None)
    assert result is None


@pytest.mark.asyncio
async def test_require_api_token_valid_x_api_key():
    result = await require_api_token(authorization=None, x_api_key="test-token")
    assert result is None


@pytest.mark.asyncio
async def test_require_api_token_no_prefix():
    with pytest.raises(HTTPException) as exc:
        await require_api_token(authorization="test-token", x_api_key=None)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_require_api_token_empty_token():
    with pytest.raises(HTTPException) as exc:
        await require_api_token(authorization="Bearer ", x_api_key=None)
    assert exc.value.status_code == 401
