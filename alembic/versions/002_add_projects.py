"""Add projects table and project_id FK to prompts.

Revision ID: 002
Revises: 001
Create Date: 2026-02-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )

    op.add_column(
        "prompts",
        sa.Column("project_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_prompts_project_id",
        "prompts",
        "projects",
        ["project_id"],
        ["id"],
    )
    op.create_index("idx_prompts_project_id", "prompts", ["project_id"])


def downgrade() -> None:
    op.drop_index("idx_prompts_project_id", table_name="prompts")
    op.drop_constraint("fk_prompts_project_id", "prompts", type_="foreignkey")
    op.drop_column("prompts", "project_id")
    op.drop_table("projects")
