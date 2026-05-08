"""reward_referral_system

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-05-08 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Extend TransactionType enum
    op.execute("ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'referral_bonus'")
    op.execute("ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'jackpot'")
    op.execute("ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'monthly_bonus'")

    # 2. Create tickettier enum
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE tickettier AS ENUM ('easy', 'medium', 'hard');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$
    """)

    # 3. Add referral columns to users
    op.add_column('users', sa.Column('referral_code', sa.String(16), nullable=True))
    op.add_column('users', sa.Column('referred_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))
    op.add_column('users', sa.Column('lifetime_referral_earnings', sa.Numeric(18, 2), nullable=False, server_default='0'))

    op.create_index('ix_users_referral_code', 'users', ['referral_code'], unique=True)

    # 4. Backfill referral_code for existing users (avoid duplicate constraint issues — use id-based codes)
    op.execute("""
        UPDATE users SET referral_code = CONCAT('u', id::text, LEFT(MD5(id::text), 6))
        WHERE referral_code IS NULL
    """)

    # 5. Create system_funds table (single-row jackpot/monthly bonus store)
    op.create_table(
        'system_funds',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('jackpot_balance', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('monthly_bonus_balance', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.execute("INSERT INTO system_funds (id, jackpot_balance, monthly_bonus_balance) VALUES (1, 0, 0)")

    # 6. Create referral_tickets table
    op.create_table(
        'referral_tickets',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('tier', sa.Enum('easy', 'medium', 'hard', name='tickettier', create_type=False), nullable=False),
        sa.Column('is_used', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('referral_tickets')
    op.drop_table('system_funds')
    op.drop_index('ix_users_referral_code', table_name='users')
    op.drop_column('users', 'lifetime_referral_earnings')
    op.drop_column('users', 'referred_by_id')
    op.drop_column('users', 'referral_code')
    op.execute("DROP TYPE IF EXISTS tickettier")
