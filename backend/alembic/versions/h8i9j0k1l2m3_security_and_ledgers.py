"""security_and_ledgers

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-05-08 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'h8i9j0k1l2m3'
down_revision: Union[str, None] = 'g7h8i9j0k1l2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Bot-detection fields on users
    op.add_column('users', sa.Column('is_blocked', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('blocked_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('block_reason', sa.String(255), nullable=True))

    # Separate financial ledgers on system_funds
    op.add_column('system_funds', sa.Column('prize_pool_balance', sa.Numeric(18, 2), nullable=False, server_default='0'))
    op.add_column('system_funds', sa.Column('referral_pool_balance', sa.Numeric(18, 2), nullable=False, server_default='0'))
    op.add_column('system_funds', sa.Column('admin_profit_balance', sa.Numeric(18, 2), nullable=False, server_default='0'))
    op.add_column('system_funds', sa.Column('total_revenue', sa.Numeric(18, 2), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('system_funds', 'total_revenue')
    op.drop_column('system_funds', 'admin_profit_balance')
    op.drop_column('system_funds', 'referral_pool_balance')
    op.drop_column('system_funds', 'prize_pool_balance')

    op.drop_column('users', 'block_reason')
    op.drop_column('users', 'blocked_at')
    op.drop_column('users', 'is_blocked')
