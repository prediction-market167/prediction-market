"""add_star_payments

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-05 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'star_payments',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('payload', sa.String(128), unique=True, index=True, nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('market_id', sa.Integer(), sa.ForeignKey('markets.id'), nullable=False),
        sa.Column('side', sa.Enum('yes', 'no', name='betside', create_type=False), nullable=False),
        sa.Column('stars_amount', sa.Integer(), nullable=False),
        sa.Column('bet_amount', sa.Numeric(18, 2), nullable=False),
        sa.Column('status', sa.Enum('PENDING', 'PAID', 'FAILED', name='starpaymentstatus'), nullable=False, server_default='PENDING'),
        sa.Column('telegram_charge_id', sa.String(255), nullable=True),
        sa.Column('bet_id', sa.Integer(), sa.ForeignKey('bets.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('star_payments')
    op.execute("DROP TYPE IF EXISTS starpaymentstatus")
