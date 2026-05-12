"""Add language_code to users

Revision ID: s9t0u1v2w3x4
Revises: r8s9t0u1v2w3
Create Date: 2026-05-12
"""
from alembic import op

revision = 's9t0u1v2w3x4'
down_revision = 'r8s9t0u1v2w3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS language_code VARCHAR(10)")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS language_code")
