"""Make individual option columns nullable (legacy columns from older schema)

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-05-10
"""
from alembic import op

revision = 'k1l2m3n4o5p6'
down_revision = 'j0k1l2m3n4o5'
branch_labels = None
depends_on = None

_OPTION_COLS = [
    'option_a_mn', 'option_b_mn', 'option_c_mn', 'option_d_mn',
    'option_a_en', 'option_b_en', 'option_c_en', 'option_d_en',
    'option_a_ru', 'option_b_ru', 'option_c_ru', 'option_d_ru',
    'option_a_hi', 'option_b_hi', 'option_c_hi', 'option_d_hi',
]


def upgrade() -> None:
    for col in _OPTION_COLS:
        op.execute(f"""
            DO $$ BEGIN
                ALTER TABLE questions ALTER COLUMN {col} DROP NOT NULL;
            EXCEPTION WHEN undefined_column THEN NULL;
            END $$
        """)


def downgrade() -> None:
    pass
