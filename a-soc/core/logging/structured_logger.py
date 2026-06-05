import json
import logging
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Dict, Optional

_trace_id: ContextVar[str] = ContextVar("trace_id", default="")
_incident_id: ContextVar[str] = ContextVar("incident_id", default="")


def set_trace_id(trace_id: Optional[str] = None) -> str:
    tid = trace_id or str(uuid.uuid4())
    _trace_id.set(tid)
    return tid


def get_trace_id() -> str:
    return _trace_id.get() or ""


def set_incident_id(incident_id: str) -> None:
    _incident_id.set(incident_id)


def get_incident_id() -> str:
    return _incident_id.get() or ""


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "trace_id": get_trace_id(),
            "incident_id": get_incident_id(),
        }
        if record.exc_info and record.exc_info[0]:
            log_entry["exception"] = self.formatException(record.exc_info)
        if hasattr(record, "extra_fields"):
            log_entry.update(record.extra_fields)
        return json.dumps(log_entry, default=str)


class StructuredLogger(logging.Logger):
    def __init__(self, name: str, level: int = logging.INFO):
        super().__init__(name, level)
        handler = logging.StreamHandler()
        handler.setFormatter(JSONFormatter())
        self.addHandler(handler)
        self.propagate = False

    def _log(self, level, msg, args, exc_info=None, extra=None, **kwargs):
        if extra is None:
            extra = {}
        if kwargs:
            extra.setdefault("extra_fields", {})
            extra["extra_fields"].update(kwargs)
        super()._log(level, msg, args, exc_info=exc_info, extra=extra)


logging.setLoggerClass(StructuredLogger)


def get_logger(name: str) -> StructuredLogger:
    return logging.getLogger(name)
