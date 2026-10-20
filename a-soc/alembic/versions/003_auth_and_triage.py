"""add real users authentication and triage columns

Revision ID: 003
Revises: 002
Create Date: 2026-10-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update incidents with triage columns
    op.add_column("incidents", sa.Column("assigned_to", sa.String(100), nullable=True))
    op.add_column("incidents", sa.Column("triage_status", sa.String(30), nullable=False, server_default="new"))
    op.add_column("incidents", sa.Column("notes", sa.Text, nullable=True, server_default=""))
    op.add_column("incidents", sa.Column("triaged_by", sa.String(100), nullable=True))
    op.add_column("incidents", sa.Column("triaged_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("incidents", sa.Column("response_actions", sa.JSON, nullable=False, server_default="[]"))
    op.add_column("incidents", sa.Column("evidence_links", sa.JSON, nullable=False, server_default="[]"))
    op.create_index("idx_incidents_triage", "incidents", ["triage_status"])
    op.create_index("idx_incidents_assigned", "incidents", ["assigned_to"])

    # 2. Update users table with password authentication & lockout columns
    op.add_column("users", sa.Column("username", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("password_hash", sa.Text, nullable=False, server_default=""))
    op.add_column("users", sa.Column("failed_login_count", sa.Integer, nullable=False, server_default="0"))
    op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    
    # Copy existing user_id into username where empty
    op.execute("UPDATE users SET username = user_id WHERE username IS NULL OR username = ''")
    
    op.alter_column("users", "username", nullable=False)
    op.create_unique_constraint("uq_users_username", "users", ["username"])
    op.create_index("idx_users_username", "users", ["username"])
    op.create_index("idx_users_role", "users", ["role"])


def downgrade() -> None:
    op.drop_index("idx_users_role", table_name="users")
    op.drop_index("idx_users_username", table_name="users")
    op.drop_constraint("uq_users_username", "users", type_="unique")
    op.drop_column("users", "updated_at")
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_count")
    op.drop_column("users", "password_hash")
    op.drop_column("users", "username")

    op.drop_index("idx_incidents_assigned", table_name="incidents")
    op.drop_index("idx_incidents_triage", table_name="incidents")
    op.drop_column("incidents", "evidence_links")
    op.drop_column("incidents", "response_actions")
    op.drop_column("incidents", "triaged_at")
    op.drop_column("incidents", "triaged_by")
    op.drop_column("incidents", "notes")
    op.drop_column("incidents", "triage_status")
    op.drop_column("incidents", "assigned_to")
