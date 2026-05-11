"""Ensure quiz columns exist on markets table (idempotent)

These columns should have been added in d4e5f6a7b8c9 but may be missing
if that migration was skipped or the DB was restored from an older snapshot.
Using ADD COLUMN IF NOT EXISTS makes this safe to run regardless of current state.

Revision ID: r8s9t0u1v2w3
Revises: q7r8s9t0u1v2
Create Date: 2026-05-11
"""
from alembic import op
import sqlalchemy as sa

revision = 'r8s9t0u1v2w3'
down_revision = 'q7r8s9t0u1v2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE markets ADD COLUMN IF NOT EXISTS title_en TEXT")
    op.execute("ALTER TABLE markets ADD COLUMN IF NOT EXISTS title_ru TEXT")
    op.execute("ALTER TABLE markets ADD COLUMN IF NOT EXISTS title_hi TEXT")
    op.execute("ALTER TABLE markets ADD COLUMN IF NOT EXISTS tier VARCHAR(10)")
    op.execute("ALTER TABLE markets ADD COLUMN IF NOT EXISTS options JSON")
    op.execute("ALTER TABLE markets ADD COLUMN IF NOT EXISTS correct_option_idx INTEGER")
    op.execute("ALTER TABLE markets ADD COLUMN IF NOT EXISTS revealed_at TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE markets ADD COLUMN IF NOT EXISTS question_id INTEGER")

    # Index on tier (IF NOT EXISTS via DO block)
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE tablename = 'markets' AND indexname = 'ix_markets_tier'
            ) THEN
                CREATE INDEX ix_markets_tier ON markets (tier);
            END IF;
        END $$
    """)

    # Partial unique index: one open market per question
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_markets_question_id
        ON markets (question_id)
        WHERE question_id IS NOT NULL AND status = 'open'
    """)

    # FK constraint (skip if already exists)
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'markets_question_id_fkey'
            ) THEN
                ALTER TABLE markets
                ADD CONSTRAINT markets_question_id_fkey
                FOREIGN KEY (question_id) REFERENCES questions(id);
            END IF;
        END $$
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE markets DROP CONSTRAINT IF EXISTS markets_question_id_fkey")
    op.execute("DROP INDEX IF EXISTS uq_markets_question_id")
    op.execute("DROP INDEX IF EXISTS ix_markets_tier")
    op.execute("ALTER TABLE markets DROP COLUMN IF EXISTS question_id")
    op.execute("ALTER TABLE markets DROP COLUMN IF EXISTS revealed_at")
    op.execute("ALTER TABLE markets DROP COLUMN IF EXISTS correct_option_idx")
    op.execute("ALTER TABLE markets DROP COLUMN IF EXISTS options")
    op.execute("ALTER TABLE markets DROP COLUMN IF EXISTS tier")
    op.execute("ALTER TABLE markets DROP COLUMN IF EXISTS title_hi")
    op.execute("ALTER TABLE markets DROP COLUMN IF EXISTS title_ru")
    op.execute("ALTER TABLE markets DROP COLUMN IF EXISTS title_en")
