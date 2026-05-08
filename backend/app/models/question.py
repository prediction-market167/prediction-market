import enum
from sqlalchemy import String, Text, Integer, Boolean, Enum, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin


class QuestionTier(str, enum.Enum):
    FREE = "free"
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class TranslationStatus(str, enum.Enum):
    PENDING = "pending"
    DONE = "done"
    FAILED = "failed"


class Question(Base, TimestampMixin):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tier: Mapped[QuestionTier] = mapped_column(Enum(QuestionTier, name="questiontier"), nullable=False, index=True)
    order_idx: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    question_mn: Mapped[str] = mapped_column(Text, nullable=False)
    question_en: Mapped[str | None] = mapped_column(Text)
    question_ru: Mapped[str | None] = mapped_column(Text)
    question_hi: Mapped[str | None] = mapped_column(Text)

    options_mn: Mapped[list] = mapped_column(JSON, nullable=False)
    options_en: Mapped[list | None] = mapped_column(JSON)
    options_ru: Mapped[list | None] = mapped_column(JSON)
    options_hi: Mapped[list | None] = mapped_column(JSON)

    correct_option_idx: Mapped[int] = mapped_column(Integer, nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    translation_status: Mapped[TranslationStatus] = mapped_column(
        Enum(TranslationStatus, name="translationstatus"),
        default=TranslationStatus.PENDING,
        nullable=False,
    )
