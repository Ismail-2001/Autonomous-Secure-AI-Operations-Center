"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-05
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("agent", sa.String(100), nullable=False),
        sa.Column("payload", sa.JSON, nullable=False, server_default="{}"),
        sa.Column("signature", sa.String(100), nullable=False, server_default=""),
        sa.Column("trace_id", sa.String(36), nullable=False, server_default=""),
        sa.Column("incident_id", sa.String(36), nullable=False, server_default=""),
    )
    op.create_index("idx_events_timestamp", "events", ["timestamp"])
    op.create_index("idx_events_agent", "events", ["agent"])
    op.create_index("idx_events_type", "events", ["event_type"])
    op.create_index("idx_events_incident", "events", ["incident_id"])


def downgrade() -> None:
    op.drop_table("events")
