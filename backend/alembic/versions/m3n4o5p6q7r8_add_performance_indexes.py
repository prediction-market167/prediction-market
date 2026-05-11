"""Add performance indexes for referral and bet queries

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
Create Date: 2026-05-11
"""
from alembic import op

revision = 'm3n4o5p6q7r8'
down_revision = 'l2m3n4o5p6q7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_users_referred_by_id ON users (referred_by_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_bets_user_id ON bets (user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_bets_market_user_status ON bets (market_id, user_id, status)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_bets_market_user_status")
    op.execute("DROP INDEX IF EXISTS ix_bets_user_id")
    op.execute("DROP INDEX IF EXISTS ix_users_referred_by_id")
