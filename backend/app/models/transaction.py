from sqlalchemy import ForeignKey, Enum, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin
from decimal import Decimal
import enum


class TransactionType(str, enum.Enum):
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    BET_PLACED = "bet_placed"
    BET_WON = "bet_won"
    BET_REFUND = "bet_refund"


class Transaction(Base, TimestampMixin):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    bet_id: Mapped[int | None] = mapped_column(ForeignKey("bets.id"))

    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    balance_before: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))

    user = relationship("User", back_populates="transactions")
