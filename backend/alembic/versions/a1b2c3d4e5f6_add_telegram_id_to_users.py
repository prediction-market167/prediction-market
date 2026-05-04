"""add_telegram_id_to_users

Revision ID: a1b2c3d4e5f6
Revises: 27723796f5d7
Create Date: 2026-05-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '27723796f5d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('telegram_id', sa.BigInteger(), nullable=True))
    op.create_index(op.f('ix_users_telegram_id'), 'users', ['telegram_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_telegram_id'), table_name='users')
    op.drop_column('users', 'telegram_id')
