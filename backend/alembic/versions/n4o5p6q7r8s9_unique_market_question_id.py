"""Add question_id column + partial unique index on markets.question_id

The d4e5f6a7b8c9 migration was edited after it ran in production so
question_id was never added to the markets table.  This migration adds
the missing column (IF NOT EXISTS for idempotency) then creates the
partial unique index so the same question can't become two live markets.

Also adds betside enum values opt2/opt3 which were in d4e5f6a7b8c9 but
may not have been applied (known PostgreSQL issue with ADD VALUE inside
an exception-handler DO block in older versions).

Revision ID: n4o5p6q7r8s9
Revises: m3n4o5p6q7r8
Create Date: 2026-05-11
"""
import sqlalchemy as sa
from alembic import op

revision = 'n4o5p6q7r8s9'
down_revision = 'm3n4o5p6q7r8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add question_id column if it was never added (migration edited post-deploy)
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'markets' AND column_name = 'question_id'
            ) THEN
                ALTER TABLE markets ADD COLUMN question_id INTEGER REFERENCES questions(id);
            END IF;
        END $$
    """)

    # Add betside enum values that may be missing (ADD VALUE cannot be inside
    # an exception block reliably; use DO with pg_enum check instead)
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = 'betside' AND e.enumlabel = 'opt2'
            ) THEN
                ALTER TYPE betside ADD VALUE 'opt2';
            END IF;
        END $$
    """)
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = 'betside' AND e.enumlabel = 'opt3'
            ) THEN
                ALTER TYPE betside ADD VALUE 'opt3';
            END IF;
        END $$
    """)

    # Partial unique index — IF NOT EXISTS makes this idempotent
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_markets_question_id
        ON markets (question_id)
        WHERE question_id IS NOT NULL
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_markets_question_id")
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'markets' AND column_name = 'question_id'
            ) THEN
                ALTER TABLE markets DROP COLUMN question_id;
            END IF;
        END $$
    """)
