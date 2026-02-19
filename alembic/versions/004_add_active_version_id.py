"""Add active_version_id to prompts table.

Revision ID: 004
Revises: 003
Create Date: 2026-02-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "prompts",
        sa.Column("active_version_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_prompts_active_version_id",
        "prompts",
        "prompt_versions",
        ["active_version_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_prompts_active_version_id", "prompts", type_="foreignkey")
    op.drop_column("prompts", "active_version_id")
