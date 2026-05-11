from sqlalchemy import String, Text, ForeignKey, Enum, DateTime, Numeric, Integer, JSON
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
    title_en: Mapped[str | None] = mapped_column(Text)
    title_ru: Mapped[str | None] = mapped_column(Text)
    title_hi: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(50), index=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    # Quiz tier (null for legacy markets)
    tier: Mapped[str | None] = mapped_column(String(10), index=True)

    status: Mapped[MarketStatus] = mapped_column(
        Enum(MarketStatus), default=MarketStatus.OPEN, index=True
    )
    outcome: Mapped[MarketOutcome] = mapped_column(
        Enum(MarketOutcome), default=MarketOutcome.UNRESOLVED
    )

    yes_probability: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=Decimal("0.5000"))
    no_probability: Mapped[Decimal] = mapped_column(Numeric(5, 4), default=Decimal("0.5000"))
    total_volume: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"))

    # Quiz question data — options is None only for legacy non-quiz markets;
    # quiz markets created by activate_question_for_tier always populate it.
    options: Mapped[dict | None] = mapped_column(JSON)  # {"mn": [...], "en": [...], "ru": [...], "hi": [...]}
    correct_option_idx: Mapped[int | None] = mapped_column(Integer)  # stored, hidden until revealed
    revealed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))
    # Partial unique index (WHERE question_id IS NOT NULL) prevents the same
    # question from being activated as two simultaneous markets. See migration
    # n4o5p6q7r8s9. NULLs are allowed for legacy non-quiz markets.
    question_id: Mapped[int | None] = mapped_column(ForeignKey("questions.id"))

    close_date: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    resolve_date: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True))

    creator = relationship("User", back_populates="markets")
    bets = relationship("Bet", back_populates="market")
