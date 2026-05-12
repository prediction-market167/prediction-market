import enum
from decimal import Decimal
from sqlalchemy import ForeignKey, Enum, Numeric, String, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin
from app.models.bet import BetSide


class StarPaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"


class StarPayment(Base, TimestampMixin):
    __tablename__ = "star_payments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    payload: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.id"), nullable=False)
    side: Mapped[BetSide] = mapped_column(
        Enum(BetSide, name="betside", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False
    )

    stars_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    bet_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)

    status: Mapped[StarPaymentStatus] = mapped_column(
        Enum(StarPaymentStatus), default=StarPaymentStatus.PENDING, nullable=False
    )
    telegram_charge_id: Mapped[str | None] = mapped_column(String(255))
    bet_id: Mapped[int | None] = mapped_column(ForeignKey("bets.id"), nullable=True)

    user = relationship("User")
    market = relationship("Market")
