"""Fix uq_markets_question_id to only block duplicate OPEN markets per question

The original partial index (WHERE question_id IS NOT NULL) prevented any two
markets from referencing the same question, even after the first was cancelled
or resolved.  This blocked the hourly scheduler from re-activating a question
whose earlier market had been cancelled (e.g. due to insufficient participants).

The new index restricts uniqueness to OPEN markets only, so cancelled/resolved
markets free up their question for reuse.

Revision ID: q7r8s9t0u1v2
Revises: p6q7r8s9t0u1
Create Date: 2026-05-11
"""
from alembic import op

revision = 'q7r8s9t0u1v2'
down_revision = 'p6q7r8s9t0u1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_markets_question_id")
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_markets_question_id
        ON markets (question_id)
        WHERE question_id IS NOT NULL AND status = 'open'
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_markets_question_id")
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_markets_question_id
        ON markets (question_id)
        WHERE question_id IS NOT NULL
    """)
