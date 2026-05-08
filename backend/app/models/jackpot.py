from sqlalchemy import Numeric, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin
from decimal import Decimal


class SystemFunds(Base, TimestampMixin):
    """Single-row table (id=1) tracking accumulated jackpot and monthly bonus pools."""
    __tablename__ = "system_funds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    jackpot_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    monthly_bonus_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
