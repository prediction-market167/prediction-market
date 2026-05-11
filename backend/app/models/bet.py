from sqlalchemy import ForeignKey, Enum, Numeric, String, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin
from decimal import Decimal
import enum


class BetSide(str, enum.Enum):
    YES = "yes"    # option 0
    NO = "no"      # option 1
    OPT2 = "opt2"  # option 2 (4-choice questions)
    OPT3 = "opt3"  # option 3 (4-choice questions)


class BetStatus(str, enum.Enum):
    ACTIVE = "active"
    WON = "won"
    LOST = "lost"
    CANCELLED = "cancelled"


OPTION_IDX_TO_SIDE = {0: BetSide.YES, 1: BetSide.NO, 2: BetSide.OPT2, 3: BetSide.OPT3}
SIDE_TO_OPTION_IDX = {v: k for k, v in OPTION_IDX_TO_SIDE.items()}


class Bet(Base, TimestampMixin):
    __tablename__ = "bets"
    __table_args__ = (
        Index("ix_bets_user_id", "user_id"),
        Index("ix_bets_market_user_status", "market_id", "user_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.id"), nullable=False, index=True)

    side: Mapped[BetSide] = mapped_column(
        Enum(BetSide, name="betside", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False
    )
    status: Mapped[BetStatus] = mapped_column(
        Enum(BetStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=BetStatus.ACTIVE
    )

    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    probability_at_bet: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    potential_payout: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    actual_payout: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))

    user = relationship("User", back_populates="bets")
    market = relationship("Market", back_populates="bets")
