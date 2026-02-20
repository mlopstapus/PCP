"""Make user_template nullable in prompt_versions.

Revision ID: 002
Revises: 001
Create Date: 2026-02-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "prompt_versions",
        "user_template",
        existing_type=sa.Text(),
        nullable=True,
    )


def downgrade() -> None:
    # Backfill any NULLs before making NOT NULL again
    op.execute("UPDATE prompt_versions SET user_template = '{{ input }}' WHERE user_template IS NULL")
    op.alter_column(
        "prompt_versions",
        "user_template",
        existing_type=sa.Text(),
        nullable=False,
    )
