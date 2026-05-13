from sqlalchemy import String, Boolean, Numeric, BigInteger, ForeignKey, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin
from decimal import Decimal
from datetime import datetime


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    telegram_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, index=True, nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(100))
    ton_wallet_address: Mapped[str | None] = mapped_column(String(66), unique=True, index=True, nullable=True)
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"))
    bonus_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)
    airdrop_claimed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_paid_entry: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)

    # Bot detection / security
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    blocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    block_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Language preference (from Telegram: 'mn', 'ru', 'en', 'hi', …)
    language_code: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Referral system
    referral_code: Mapped[str | None] = mapped_column(String(16), unique=True, index=True, nullable=True)
    referred_by_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    lifetime_referral_earnings: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"), nullable=False)

    bets = relationship("Bet", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")
    markets = relationship("Market", back_populates="creator")
    referred_by = relationship("User", foreign_keys=[referred_by_id], remote_side="User.id")
