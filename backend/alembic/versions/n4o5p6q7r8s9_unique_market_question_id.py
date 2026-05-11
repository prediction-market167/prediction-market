"""Add partial unique index on markets.question_id

Prevents the same question from being activated as two concurrent markets.
NULL values are excluded so legacy non-quiz markets (question_id IS NULL)
are not affected.

Revision ID: n4o5p6q7r8s9
Revises: m3n4o5p6q7r8
Create Date: 2026-05-11
"""
from alembic import op

revision = 'n4o5p6q7r8s9'
down_revision = 'm3n4o5p6q7r8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_markets_question_id
        ON markets (question_id)
        WHERE question_id IS NOT NULL
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_markets_question_id")
