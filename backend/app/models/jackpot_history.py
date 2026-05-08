from sqlalchemy import Integer, Numeric, String, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin
from decimal import Decimal


class JackpotHistory(Base, TimestampMixin):
    __tablename__ = "jackpot_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    winner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    winner_username: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    criteria: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    triggered_by_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
