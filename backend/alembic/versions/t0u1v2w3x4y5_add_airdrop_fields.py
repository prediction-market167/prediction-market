"""Add airdrop bonus_balance and airdrop_claimed to users

Revision ID: t0u1v2w3x4y5
Revises: s9t0u1v2w3x4
Create Date: 2026-05-13
"""
from alembic import op

revision = 't0u1v2w3x4y5'
down_revision = 's9t0u1v2w3x4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_balance NUMERIC(18,2) NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS airdrop_claimed BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'airdrop'")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS bonus_balance")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS airdrop_claimed")
