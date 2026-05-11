"""Add check constraint: quiz markets must have options populated

Revision ID: o5p6q7r8s9t0
Revises: n4o5p6q7r8s9
Create Date: 2026-05-11
"""
from alembic import op

revision = 'o5p6q7r8s9t0'
down_revision = 'n4o5p6q7r8s9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # NOT VALID skips scanning existing rows so the ALTER TABLE completes
    # instantly without a full table lock. New inserts/updates are enforced
    # immediately. Run VALIDATE CONSTRAINT later if you need to certify
    # historical rows too.
    # Wrapped in a DO block: skips if constraint already exists (idempotent).
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'ck_markets_quiz_options_not_null'
            ) THEN
                ALTER TABLE markets
                ADD CONSTRAINT ck_markets_quiz_options_not_null
                CHECK (tier IS NULL OR options IS NOT NULL)
                NOT VALID;
            END IF;
        END $$
    """)


def downgrade() -> None:
    op.execute(
        "ALTER TABLE markets DROP CONSTRAINT IF EXISTS ck_markets_quiz_options_not_null"
    )
