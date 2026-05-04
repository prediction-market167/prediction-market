from sqlalchemy import String, Boolean, Numeric, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin
from decimal import Decimal


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    telegram_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, index=True, nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(100))
    ton_wallet_address: Mapped[str | None] = mapped_column(String(66), unique=True, index=True, nullable=True)
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("1000.00"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)

    bets = relationship("Bet", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")
    markets = relationship("Market", back_populates="creator")
