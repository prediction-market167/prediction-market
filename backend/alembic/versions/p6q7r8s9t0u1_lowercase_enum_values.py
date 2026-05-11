"""Rename all PostgreSQL enum values from UPPERCASE to lowercase

The initial migration created enum types with uppercase member NAMES
(OPEN, CLOSED, YES, ACTIVE, ...) but the Python models use lowercase
member VALUES (open, closed, yes, active, ...).  This mismatch causes
every INSERT and SELECT on markets, bets, and transactions to crash.

Each rename is wrapped in a DO block that checks pg_enum first, so
the migration is fully idempotent — safe to run even if the DB was
originally created with lowercase values via SQLAlchemy create_all().

Revision ID: p6q7r8s9t0u1
Revises: o5p6q7r8s9t0
Create Date: 2026-05-11
"""
from alembic import op

revision = 'p6q7r8s9t0u1'
down_revision = 'o5p6q7r8s9t0'
branch_labels = None
depends_on = None


def _rename_if_exists(type_name: str, old_val: str, new_val: str) -> str:
    """Return a DO block that renames an enum value only if it currently exists."""
    return f"""
        DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                WHERE t.typname = '{type_name}' AND e.enumlabel = '{old_val}'
            ) THEN
                EXECUTE 'ALTER TYPE {type_name} RENAME VALUE ''{old_val}'' TO ''{new_val}''';
            END IF;
        END $$
    """


def upgrade() -> None:
    for old, new in [('OPEN', 'open'), ('CLOSED', 'closed'), ('RESOLVED', 'resolved'), ('CANCELLED', 'cancelled')]:
        op.execute(_rename_if_exists('marketstatus', old, new))

    for old, new in [('YES', 'yes'), ('NO', 'no'), ('UNRESOLVED', 'unresolved')]:
        op.execute(_rename_if_exists('marketoutcome', old, new))

    # betside: opt2/opt3 added lowercase in d4e5f6a7b8c9
    for old, new in [('YES', 'yes'), ('NO', 'no')]:
        op.execute(_rename_if_exists('betside', old, new))

    for old, new in [('ACTIVE', 'active'), ('WON', 'won'), ('LOST', 'lost'), ('CANCELLED', 'cancelled')]:
        op.execute(_rename_if_exists('betstatus', old, new))

    # transactiontype: referral_bonus/jackpot/monthly_bonus added lowercase in e5f6a7b8c9d0
    for old, new in [('DEPOSIT', 'deposit'), ('WITHDRAWAL', 'withdrawal'),
                     ('BET_PLACED', 'bet_placed'), ('BET_WON', 'bet_won'), ('BET_REFUND', 'bet_refund')]:
        op.execute(_rename_if_exists('transactiontype', old, new))


def downgrade() -> None:
    for old, new in [('deposit', 'DEPOSIT'), ('withdrawal', 'WITHDRAWAL'),
                     ('bet_placed', 'BET_PLACED'), ('bet_won', 'BET_WON'), ('bet_refund', 'BET_REFUND')]:
        op.execute(_rename_if_exists('transactiontype', old, new))

    for old, new in [('active', 'ACTIVE'), ('won', 'WON'), ('lost', 'LOST'), ('cancelled', 'CANCELLED')]:
        op.execute(_rename_if_exists('betstatus', old, new))

    for old, new in [('yes', 'YES'), ('no', 'NO')]:
        op.execute(_rename_if_exists('betside', old, new))

    for old, new in [('yes', 'YES'), ('no', 'NO'), ('unresolved', 'UNRESOLVED')]:
        op.execute(_rename_if_exists('marketoutcome', old, new))

    for old, new in [('open', 'OPEN'), ('closed', 'CLOSED'), ('resolved', 'RESOLVED'), ('cancelled', 'CANCELLED')]:
        op.execute(_rename_if_exists('marketstatus', old, new))
