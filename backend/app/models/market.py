from sqlalchemy import String, Text, ForeignKey, Enum, DateTime, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin
from decimal import Decimal
import enum


class MarketStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"
    RESOLVED = "resolved"
    CANCELLED = "cancelled"


class MarketOutcome(str, enum.Enum):
    YES = "yes"
    NO = "no"
    UNRESOLVED = "unresolved"


class Market(Base, TimestampMixin):
    __tablename__ = "markets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(50), index=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    status: Mapped[MarketStatus] = mapped_column(
        Enum(MarketStatus), default=MarketStatus.OPEN, index=True
    )
    outcome: Mapped[MarketOutcome] = mapped_column(
        Enum(MarketOutcome), default=MarketOutcome.UNRESOLVED
    )

    yes_probability: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=Decimal("0.5000"))
    no_probability: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=Decimal("0.5000"))
    total_volume: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"))

    close_date: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    resolve_date: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))

    creator = relationship("User", back_populates="markets")
    bets = relationship("Bet", back_populates="market")
