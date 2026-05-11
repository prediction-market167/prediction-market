"""Rename all PostgreSQL enum values from UPPERCASE to lowercase

The initial migration created enum types with uppercase member NAMES
(OPEN, CLOSED, YES, ACTIVE, ...) but the Python models use lowercase
member VALUES (open, closed, yes, active, ...).  This mismatch causes
every INSERT and SELECT on markets, bets, and transactions to crash.

ALTER TYPE ... RENAME VALUE changes the type definition in-place; existing
rows are updated automatically because PostgreSQL stores enum values as
internal OIDs, not as strings.

Revision ID: p6q7r8s9t0u1
Revises: o5p6q7r8s9t0
Create Date: 2026-05-11
"""
from alembic import op

revision = 'p6q7r8s9t0u1'
down_revision = 'o5p6q7r8s9t0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # marketstatus
    op.execute("ALTER TYPE marketstatus RENAME VALUE 'OPEN' TO 'open'")
    op.execute("ALTER TYPE marketstatus RENAME VALUE 'CLOSED' TO 'closed'")
    op.execute("ALTER TYPE marketstatus RENAME VALUE 'RESOLVED' TO 'resolved'")
    op.execute("ALTER TYPE marketstatus RENAME VALUE 'CANCELLED' TO 'cancelled'")

    # marketoutcome
    op.execute("ALTER TYPE marketoutcome RENAME VALUE 'YES' TO 'yes'")
    op.execute("ALTER TYPE marketoutcome RENAME VALUE 'NO' TO 'no'")
    op.execute("ALTER TYPE marketoutcome RENAME VALUE 'UNRESOLVED' TO 'unresolved'")

    # betside — opt2/opt3 were added lowercase in d4e5f6a7b8c9, skip them
    op.execute("ALTER TYPE betside RENAME VALUE 'YES' TO 'yes'")
    op.execute("ALTER TYPE betside RENAME VALUE 'NO' TO 'no'")

    # betstatus
    op.execute("ALTER TYPE betstatus RENAME VALUE 'ACTIVE' TO 'active'")
    op.execute("ALTER TYPE betstatus RENAME VALUE 'WON' TO 'won'")
    op.execute("ALTER TYPE betstatus RENAME VALUE 'LOST' TO 'lost'")
    op.execute("ALTER TYPE betstatus RENAME VALUE 'CANCELLED' TO 'cancelled'")

    # transactiontype — referral_bonus/jackpot/monthly_bonus were added lowercase
    # in e5f6a7b8c9d0, skip them
    op.execute("ALTER TYPE transactiontype RENAME VALUE 'DEPOSIT' TO 'deposit'")
    op.execute("ALTER TYPE transactiontype RENAME VALUE 'WITHDRAWAL' TO 'withdrawal'")
    op.execute("ALTER TYPE transactiontype RENAME VALUE 'BET_PLACED' TO 'bet_placed'")
    op.execute("ALTER TYPE transactiontype RENAME VALUE 'BET_WON' TO 'bet_won'")
    op.execute("ALTER TYPE transactiontype RENAME VALUE 'BET_REFUND' TO 'bet_refund'")


def downgrade() -> None:
    op.execute("ALTER TYPE transactiontype RENAME VALUE 'bet_refund' TO 'BET_REFUND'")
    op.execute("ALTER TYPE transactiontype RENAME VALUE 'bet_won' TO 'BET_WON'")
    op.execute("ALTER TYPE transactiontype RENAME VALUE 'bet_placed' TO 'BET_PLACED'")
    op.execute("ALTER TYPE transactiontype RENAME VALUE 'withdrawal' TO 'WITHDRAWAL'")
    op.execute("ALTER TYPE transactiontype RENAME VALUE 'deposit' TO 'DEPOSIT'")

    op.execute("ALTER TYPE betstatus RENAME VALUE 'cancelled' TO 'CANCELLED'")
    op.execute("ALTER TYPE betstatus RENAME VALUE 'lost' TO 'LOST'")
    op.execute("ALTER TYPE betstatus RENAME VALUE 'won' TO 'WON'")
    op.execute("ALTER TYPE betstatus RENAME VALUE 'active' TO 'ACTIVE'")

    op.execute("ALTER TYPE betside RENAME VALUE 'no' TO 'NO'")
    op.execute("ALTER TYPE betside RENAME VALUE 'yes' TO 'YES'")

    op.execute("ALTER TYPE marketoutcome RENAME VALUE 'unresolved' TO 'UNRESOLVED'")
    op.execute("ALTER TYPE marketoutcome RENAME VALUE 'no' TO 'NO'")
    op.execute("ALTER TYPE marketoutcome RENAME VALUE 'yes' TO 'YES'")

    op.execute("ALTER TYPE marketstatus RENAME VALUE 'cancelled' TO 'CANCELLED'")
    op.execute("ALTER TYPE marketstatus RENAME VALUE 'resolved' TO 'RESOLVED'")
    op.execute("ALTER TYPE marketstatus RENAME VALUE 'closed' TO 'CLOSED'")
    op.execute("ALTER TYPE marketstatus RENAME VALUE 'open' TO 'OPEN'")
