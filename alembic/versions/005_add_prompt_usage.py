"""Add prompt_usage table for metrics tracking.

Revision ID: 005
Revises: 004
Create Date: 2026-02-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "prompt_usage",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("prompt_name", sa.String(255), nullable=False),
        sa.Column("prompt_version", sa.String(50), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("latency_ms", sa.Float(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_prompt_usage_prompt_name", "prompt_usage", ["prompt_name"])
    op.create_index("idx_prompt_usage_created_at", "prompt_usage", ["created_at"])


def downgrade() -> None:
    op.drop_index("idx_prompt_usage_created_at", table_name="prompt_usage")
    op.drop_index("idx_prompt_usage_prompt_name", table_name="prompt_usage")
    op.drop_table("prompt_usage")
