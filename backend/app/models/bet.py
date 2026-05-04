from sqlalchemy import ForeignKey, Enum, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin
from decimal import Decimal
import enum


class BetSide(str, enum.Enum):
    YES = "yes"
    NO = "no"


class BetStatus(str, enum.Enum):
    ACTIVE = "active"
    WON = "won"
    LOST = "lost"
    CANCELLED = "cancelled"


class Bet(Base, TimestampMixin):
    __tablename__ = "bets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.id"), nullable=False, index=True)

    side: Mapped[BetSide] = mapped_column(Enum(BetSide), nullable=False)
    status: Mapped[BetStatus] = mapped_column(Enum(BetStatus), default=BetStatus.ACTIVE)

    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    probability_at_bet: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    potential_payout: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    actual_payout: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))

    user = relationship("User", back_populates="bets")
    market = relationship("Market", back_populates="bets")
