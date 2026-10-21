"""Create jobs table for worker pipeline

Revision ID: 004
Revises: 003
Create Date: 2026-10-20
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("incident_id", sa.String(36), nullable=False),
        sa.Column("state", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("attempt", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("locked_by", sa.String(128), nullable=True),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("heartbeat_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("state_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_jobs_state_locked_at", "jobs", ["state", "locked_at"])
    op.create_index("idx_jobs_incident_id", "jobs", ["incident_id"])
    op.create_index("idx_jobs_locked_by", "jobs", ["locked_by"])


def downgrade() -> None:
    op.drop_index("idx_jobs_locked_by", table_name="jobs")
    op.drop_index("idx_jobs_incident_id", table_name="jobs")
    op.drop_index("idx_jobs_state_locked_at", table_name="jobs")
    op.drop_table("jobs")
