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

questionstatus = sa.Enum('unused', 'scheduled_unused', 'used', name='questionstatus')


def upgrade() -> None:
    questionstatus.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'questions',
        sa.Column(
            'status',
            questionstatus,
            nullable=False,
            server_default='unused',
        ),
    )
    # Backfill: existing is_used=true rows become 'used', false stays 'unused'
    op.execute("UPDATE questions SET status = 'used' WHERE is_used = true")
    op.execute("UPDATE questions SET status = 'unused' WHERE is_used = false")


def downgrade() -> None:
    op.drop_column('questions', 'status')
    questionstatus.drop(op.get_bind(), checkfirst=True)
