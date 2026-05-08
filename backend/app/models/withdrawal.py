import enum
from sqlalchemy import Integer, Numeric, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin
from decimal import Decimal


class WithdrawalStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class Withdrawal(Base, TimestampMixin):
    __tablename__ = "withdrawals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount_stars: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    amount_ton: Mapped[Decimal] = mapped_column(Numeric(18, 9), nullable=False)
    wallet_address: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
