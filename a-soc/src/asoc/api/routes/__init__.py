"""API route modules.

This package contains the route definitions extracted from app.py.
Each module imports `router` from here and registers its endpoints on it.
"""

import os

from fastapi import APIRouter

from src.asoc.core.event_store import EventStore, PostgresEventStore

router = APIRouter(prefix="/api/v1")

_event_store_instance = None


def get_event_store() -> EventStore:
    global _event_store_instance
    if _event_store_instance is None:
        _db_url = os.getenv("DATABASE_URL", "")
        if _db_url and "localhost" not in _db_url:
            _event_store_instance = PostgresEventStore()
        else:
            _event_store_instance = EventStore()
    return _event_store_instance
