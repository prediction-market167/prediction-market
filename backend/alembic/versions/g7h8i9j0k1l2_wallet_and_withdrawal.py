"""wallet_and_withdrawal

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
Create Date: 2026-05-08 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'g7h8i9j0k1l2'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'system_funds',
        sa.Column('stars_to_ton_rate', sa.Numeric(18, 6), nullable=False, server_default='100'),
    )
    op.create_table(
        'withdrawals',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('amount_stars', sa.Numeric(18, 2), nullable=False),
        sa.Column('amount_ton', sa.Numeric(18, 9), nullable=False),
        sa.Column('wallet_address', sa.String(100), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('note', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_withdrawals_user_id', 'withdrawals', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_withdrawals_user_id', 'withdrawals')
    op.drop_table('withdrawals')
    op.drop_column('system_funds', 'stars_to_ton_rate')
