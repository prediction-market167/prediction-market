"""Make all non-essential question columns nullable (legacy schema cleanup)

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-05-10
"""
from alembic import op
from sqlalchemy import text

revision = 'l2m3n4o5p6q7'
down_revision = 'k1l2m3n4o5p6'
branch_labels = None
depends_on = None

# Columns that must stay NOT NULL
_REQUIRED = {
    'id', 'tier', 'order_idx', 'question_mn', 'options_mn',
    'correct_option_idx', 'is_used', 'status', 'translation_status',
    'created_at', 'updated_at',
}


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name   = 'questions'
          AND table_schema = 'public'
          AND is_nullable  = 'NO'
          AND column_name  != 'id'
    """))
    for (col,) in rows:
        if col not in _REQUIRED:
            conn.execute(text(f'ALTER TABLE questions ALTER COLUMN "{col}" DROP NOT NULL'))


def downgrade() -> None:
    pass
