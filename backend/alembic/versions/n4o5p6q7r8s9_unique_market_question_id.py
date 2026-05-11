"""Add missing quiz columns to markets + partial unique index on question_id

The d4e5f6a7b8c9 migration was edited heavily after it ran in production.
The questions table was created, but none of the market column additions
(tier, title_en/ru/hi, options, correct_option_idx, revealed_at, question_id)
were applied.  This migration adds all of them idempotently using
information_schema checks, then creates the partial unique index.

Also adds betside enum values opt2/opt3 which were missing for the same reason.

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


def _add_column_if_missing(table: str, column: str, ddl: str) -> None:
    op.execute(f"""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = '{table}' AND column_name = '{column}'
            ) THEN
                ALTER TABLE {table} ADD COLUMN {ddl};
            END IF;
        END $$
    """)


def upgrade() -> None:
    # --- Add all quiz-related columns that d4e5f6a7b8c9 should have added ---
    _add_column_if_missing('markets', 'tier',             'tier VARCHAR(10)')
    _add_column_if_missing('markets', 'title_en',         'title_en TEXT')
    _add_column_if_missing('markets', 'title_ru',         'title_ru TEXT')
    _add_column_if_missing('markets', 'title_hi',         'title_hi TEXT')
    _add_column_if_missing('markets', 'options',          'options JSON')
    _add_column_if_missing('markets', 'correct_option_idx', 'correct_option_idx INTEGER')
    _add_column_if_missing('markets', 'revealed_at',      'revealed_at TIMESTAMP WITH TIME ZONE')
    _add_column_if_missing('markets', 'question_id',      'question_id INTEGER REFERENCES questions(id)')

    # Create index on tier if missing (was part of d4e5f6a7b8c9)
    op.execute("CREATE INDEX IF NOT EXISTS ix_markets_tier ON markets (tier)")

    # --- Add betside enum values that were also missing ---
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

    # --- Partial unique index on question_id ---
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_markets_question_id
        ON markets (question_id)
        WHERE question_id IS NOT NULL
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_markets_question_id")
    op.execute("DROP INDEX IF EXISTS ix_markets_tier")
    for col in ('question_id', 'revealed_at', 'correct_option_idx',
                'options', 'title_hi', 'title_ru', 'title_en', 'tier'):
        _add_column_if_missing  # no-op; don't drop on downgrade to avoid data loss
