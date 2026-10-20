import pytest

from core.logging import get_logger, get_request_id, set_request_id


def test_get_set_request_id():
    rid = set_request_id()
    assert len(rid) > 0
    assert get_request_id() == rid


def test_set_request_id_custom():
    set_request_id("custom-id")
    assert get_request_id() == "custom-id"


def test_get_request_id_default():
    from core.logging.structured_logger import _request_id

    _request_id.set("")
    assert get_request_id() == ""


def test_logger_creates():
    logger = get_logger("test-logger")
    assert logger.name == "test-logger"
