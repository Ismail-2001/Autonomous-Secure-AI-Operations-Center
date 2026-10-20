"""SQLAlchemy models for A-SOC database tables."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── Events ─────────────────────────────────────────────────────────────────


class Event(Base):
    __tablename__ = "events"

    id = Column(String(36), primary_key=True, default=_uuid)
    timestamp = Column(DateTime(timezone=True), nullable=False, default=_now, server_default="now()")
    event_type = Column(String(100), nullable=False, index=True)
    agent = Column(String(100), nullable=False, index=True)
    payload = Column(JSON, nullable=False, default=dict)
    signature = Column(String(128), nullable=False, default="")
    trace_id = Column(String(36), nullable=False, default="", index=True)
    incident_id = Column(String(36), nullable=False, default="", index=True)
    status = Column(String(20), nullable=False, default="active")

    __table_args__ = (Index("idx_events_timestamp", "timestamp", postgresql_using="btree"),)


# ── Incidents ──────────────────────────────────────────────────────────────


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String(36), primary_key=True, default=_uuid)
    incident_number = Column(String(30), nullable=False, unique=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False, default="")
    severity = Column(String(20), nullable=False, default="low")
    status = Column(String(30), nullable=False, default="open")
    source = Column(String(100), nullable=False, default="unknown")
    agent = Column(String(100), nullable=False, default="DetectionAgent")
    risk_score = Column(Float, nullable=False, default=0.0)
    tags = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now, server_default="now()")
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, server_default="now()")


# ── Assets ─────────────────────────────────────────────────────────────────


class Asset(Base):
    __tablename__ = "assets"

    id = Column(String(36), primary_key=True, default=_uuid)
    asset_number = Column(String(30), nullable=False, unique=True, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False, default="server")
    ip_address = Column(String(45), nullable=False, default="")
    os = Column(String(50), nullable=False, default="unknown")
    status = Column(String(20), nullable=False, default="online")
    risk_score = Column(Float, nullable=False, default=0.0)
    vulnerabilities = Column(Integer, nullable=False, default=0)
    owner = Column(String(100), nullable=False, default="UNKNOWN")
    tags = Column(JSON, nullable=False, default=list)
    last_scan = Column(DateTime(timezone=True), nullable=False, default=_now, server_default="now()")
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now, server_default="now()")

    __table_args__ = (
        Index("idx_assets_risk", "risk_score"),
        Index("idx_assets_type", "type"),
    )


# ── Forensics Jobs ─────────────────────────────────────────────────────────


class ForensicsJob(Base):
    __tablename__ = "forensics_jobs"

    id = Column(String(36), primary_key=True, default=_uuid)
    job_number = Column(String(30), nullable=False, unique=True, index=True)
    title = Column(String(255), nullable=False)
    status = Column(String(30), nullable=False, default="pending")
    evidence_type = Column(String(50), nullable=False, default="volatile")
    findings = Column(JSON, nullable=False, default=list)
    artifacts = Column(JSON, nullable=False, default=list)
    agent = Column(String(100), nullable=False, default="ForensicsAgent")
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now, server_default="now()")
    completed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("idx_forensics_status", "status"),)


# ── Threat Indicators ──────────────────────────────────────────────────────


class ThreatIndicator(Base):
    __tablename__ = "threat_indicators"

    id = Column(String(36), primary_key=True, default=_uuid)
    indicator_number = Column(String(30), nullable=False, unique=True, index=True)
    type = Column(String(20), nullable=False)
    value = Column(String(512), nullable=False)
    severity = Column(String(20), nullable=False, default="low")
    confidence = Column(Float, nullable=False, default=0.0)
    source = Column(String(100), nullable=False, default="unknown")
    tlp = Column(String(10), nullable=False, default="GREEN")
    tags = Column(JSON, nullable=False, default=list)
    first_seen = Column(DateTime(timezone=True), nullable=False, default=_now, server_default="now()")
    last_seen = Column(DateTime(timezone=True), nullable=False, default=_now, server_default="now()")

    __table_args__ = (
        Index("idx_ioc_type", "type"),
        Index("idx_ioc_severity", "severity"),
    )


# ── Compliance Controls ────────────────────────────────────────────────────


class ComplianceControl(Base):
    __tablename__ = "compliance_controls"

    id = Column(String(36), primary_key=True, default=_uuid)
    control_id = Column(String(30), nullable=False, unique=True, index=True)
    framework = Column(String(30), nullable=False, default="SOC2")
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False, default="")
    status = Column(String(20), nullable=False, default="PENDING")
    last_checked = Column(DateTime(timezone=True), nullable=False, default=_now, server_default="now()")

    __table_args__ = (
        Index("idx_compliance_framework", "framework"),
        Index("idx_compliance_status", "status"),
    )


# ── Users ──────────────────────────────────────────────────────────────────


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(128), nullable=False, unique=True, index=True)
    role = Column(String(20), nullable=False, default="analyst")
    client_id = Column(String(128), nullable=False, default="default")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now, server_default="now()")
    last_login = Column(DateTime(timezone=True), nullable=True)


# ── Audit Log ──────────────────────────────────────────────────────────────


class AuditEntry(Base):
    __tablename__ = "audit_entries"

    id = Column(String(36), primary_key=True, default=_uuid)
    timestamp = Column(DateTime(timezone=True), nullable=False, default=_now, server_default="now()")
    agent_id = Column(String(100), nullable=False, index=True)
    action = Column(String(100), nullable=False, index=True)
    payload = Column(JSON, nullable=False, default=dict)
    signature = Column(String(128), nullable=False, default="")

    __table_args__ = (Index("idx_audit_timestamp", "timestamp"),)
