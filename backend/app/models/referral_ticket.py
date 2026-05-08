import enum
from sqlalchemy import ForeignKey, Enum, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class TicketTier(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class ReferralTicket(Base, TimestampMixin):
    """Free-entry ticket earned by referral milestones."""
    __tablename__ = "referral_tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    tier: Mapped[TicketTier] = mapped_column(Enum(TicketTier, name="tickettier"), nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
