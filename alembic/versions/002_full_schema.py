"""add full schema: incidents, assets, forensics, indicators, compliance, users, audit

Revision ID: 002
Revises: 001
Create Date: 2026-07-04
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Incidents
    op.create_table(
        "incidents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("incident_number", sa.String(30), nullable=False, unique=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column("severity", sa.String(20), nullable=False, server_default="low"),
        sa.Column("status", sa.String(30), nullable=False, server_default="open"),
        sa.Column("source", sa.String(100), nullable=False, server_default="unknown"),
        sa.Column("agent", sa.String(100), nullable=False, server_default="DetectionAgent"),
        sa.Column("risk_score", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("tags", sa.JSON, nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_incidents_number", "incidents", ["incident_number"])
    op.create_index("idx_incidents_severity", "incidents", ["severity"])
    op.create_index("idx_incidents_status", "incidents", ["status"])

    # Assets
    op.create_table(
        "assets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("asset_number", sa.String(30), nullable=False, unique=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("type", sa.String(50), nullable=False, server_default="server"),
        sa.Column("ip_address", sa.String(45), nullable=False, server_default=""),
        sa.Column("os", sa.String(50), nullable=False, server_default="unknown"),
        sa.Column("status", sa.String(20), nullable=False, server_default="online"),
        sa.Column("risk_score", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("vulnerabilities", sa.Integer, nullable=False, server_default="0"),
        sa.Column("owner", sa.String(100), nullable=False, server_default="UNKNOWN"),
        sa.Column("tags", sa.JSON, nullable=False, server_default="[]"),
        sa.Column("last_scan", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_assets_risk", "assets", ["risk_score"])
    op.create_index("idx_assets_type", "assets", ["type"])

    # Forensics jobs
    op.create_table(
        "forensics_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("job_number", sa.String(30), nullable=False, unique=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("evidence_type", sa.String(50), nullable=False, server_default="volatile"),
        sa.Column("findings", sa.JSON, nullable=False, server_default="[]"),
        sa.Column("artifacts", sa.JSON, nullable=False, server_default="[]"),
        sa.Column("agent", sa.String(100), nullable=False, server_default="ForensicsAgent"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_forensics_status", "forensics_jobs", ["status"])

    # Threat indicators
    op.create_table(
        "threat_indicators",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("indicator_number", sa.String(30), nullable=False, unique=True),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("value", sa.String(512), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default="low"),
        sa.Column("confidence", sa.Float, nullable=False, server_default="0.0"),
        sa.Column("source", sa.String(100), nullable=False, server_default="unknown"),
        sa.Column("tlp", sa.String(10), nullable=False, server_default="GREEN"),
        sa.Column("tags", sa.JSON, nullable=False, server_default="[]"),
        sa.Column("first_seen", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_ioc_type", "threat_indicators", ["type"])
    op.create_index("idx_ioc_severity", "threat_indicators", ["severity"])

    # Compliance controls
    op.create_table(
        "compliance_controls",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("control_id", sa.String(30), nullable=False, unique=True),
        sa.Column("framework", sa.String(30), nullable=False, server_default="SOC2"),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("last_checked", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_compliance_framework", "compliance_controls", ["framework"])

    # Users
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(128), nullable=False, unique=True),
        sa.Column("role", sa.String(20), nullable=False, server_default="analyst"),
        sa.Column("client_id", sa.String(128), nullable=False, server_default="default"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
    )

    # Audit entries
    op.create_table(
        "audit_entries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("agent_id", sa.String(100), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("payload", sa.JSON, nullable=False, server_default="{}"),
        sa.Column("signature", sa.String(128), nullable=False, server_default=""),
    )
    op.create_index("idx_audit_agent", "audit_entries", ["agent_id"])
    op.create_index("idx_audit_action", "audit_entries", ["action"])
    op.create_index("idx_audit_timestamp", "audit_entries", ["timestamp"])


def downgrade() -> None:
    op.drop_table("audit_entries")
    op.drop_table("users")
    op.drop_table("compliance_controls")
    op.drop_table("threat_indicators")
    op.drop_table("forensics_jobs")
    op.drop_table("assets")
    op.drop_table("incidents")
