"""question_status

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-05-09 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'i9j0k1l2m3n4'
down_revision: Union[str, None] = 'h8i9j0k1l2m3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ensure the enum type exists (safe on both fresh and existing databases)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE questionstatus AS ENUM ('unused', 'scheduled_unused', 'used');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$
    """)

    # Add the column only if it doesn't already exist.
    # On fresh databases the column is already included in the create_table in
    # d4e5f6a7b8c9, so this becomes a no-op.
    op.execute("""
        ALTER TABLE questions
            ADD COLUMN IF NOT EXISTS status questionstatus NOT NULL DEFAULT 'unused'
    """)

    # Backfill: existing is_used=true rows become 'used'
    op.execute("UPDATE questions SET status = 'used' WHERE is_used = true AND status = 'unused'")


def downgrade() -> None:
    op.execute("""
        ALTER TABLE questions DROP COLUMN IF EXISTS status
    """)
    op.execute("DROP TYPE IF EXISTS questionstatus")
