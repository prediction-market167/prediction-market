"""add_question_system

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-08 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add new values to betside enum (PostgreSQL requires these to be committed first)
    op.execute("ALTER TYPE betside ADD VALUE IF NOT EXISTS 'opt2'")
    op.execute("ALTER TYPE betside ADD VALUE IF NOT EXISTS 'opt3'")

    # 2. Create enum types for questions
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE questiontier AS ENUM ('free', 'easy', 'medium', 'hard');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE translationstatus AS ENUM ('pending', 'done', 'failed');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$
    """)

    # 3. Create questions table
    op.create_table(
        'questions',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('tier', sa.Enum('free', 'easy', 'medium', 'hard', name='questiontier', create_type=False), nullable=False, index=True),
        sa.Column('order_idx', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('question_mn', sa.Text(), nullable=False),
        sa.Column('question_en', sa.Text(), nullable=True),
        sa.Column('question_ru', sa.Text(), nullable=True),
        sa.Column('question_hi', sa.Text(), nullable=True),
        sa.Column('options_mn', sa.JSON(), nullable=False),
        sa.Column('options_en', sa.JSON(), nullable=True),
        sa.Column('options_ru', sa.JSON(), nullable=True),
        sa.Column('options_hi', sa.JSON(), nullable=True),
        sa.Column('correct_option_idx', sa.Integer(), nullable=False),
        sa.Column('is_used', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('translation_status', sa.Enum('pending', 'done', 'failed', name='translationstatus', create_type=False), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 4. Add columns to markets table
    op.add_column('markets', sa.Column('tier', sa.String(10), nullable=True, index=True))
    op.add_column('markets', sa.Column('title_en', sa.Text(), nullable=True))
    op.add_column('markets', sa.Column('title_ru', sa.Text(), nullable=True))
    op.add_column('markets', sa.Column('title_hi', sa.Text(), nullable=True))
    op.add_column('markets', sa.Column('options', sa.JSON(), nullable=True))
    op.add_column('markets', sa.Column('correct_option_idx', sa.Integer(), nullable=True))
    op.add_column('markets', sa.Column('revealed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('markets', sa.Column('question_id', sa.Integer(), sa.ForeignKey('questions.id'), nullable=True))


def downgrade() -> None:
    op.drop_column('markets', 'question_id')
    op.drop_column('markets', 'revealed_at')
    op.drop_column('markets', 'correct_option_idx')
    op.drop_column('markets', 'options')
    op.drop_column('markets', 'title_hi')
    op.drop_column('markets', 'title_ru')
    op.drop_column('markets', 'title_en')
    op.drop_column('markets', 'tier')
    op.drop_table('questions')
    op.execute("DROP TYPE IF EXISTS questiontier")
    op.execute("DROP TYPE IF EXISTS translationstatus")
