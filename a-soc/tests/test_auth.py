import os
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from core.auth import require_api_token


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
    os.environ["WS_API_TOKEN"] = "test-token"
    result = await require_api_token(authorization="Bearer test-token", x_api_key=None)
    assert result is None


@pytest.mark.asyncio
async def test_require_api_token_valid_x_api_key():
    os.environ["WS_API_TOKEN"] = "test-key"
    result = await require_api_token(authorization=None, x_api_key="test-key")
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
