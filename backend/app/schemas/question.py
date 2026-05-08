from pydantic import BaseModel
from datetime import datetime
from app.models.question import QuestionTier, TranslationStatus


class QuestionBase(BaseModel):
    tier: QuestionTier
    question_mn: str
    correct_option_idx: int
    options_mn: list[str]


class QuestionResponse(BaseModel):
    id: int
    tier: QuestionTier
    order_idx: int
    question_mn: str
    question_en: str | None
    question_ru: str | None
    question_hi: str | None
    options_mn: list[str]
    options_en: list[str] | None
    options_ru: list[str] | None
    options_hi: list[str] | None
    correct_option_idx: int
    is_used: bool
    translation_status: TranslationStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class QuestionUploadRow(BaseModel):
    tier: QuestionTier
    question_mn: str
    options_mn: list[str]
    correct_option_idx: int  # 0-based


class TranslationRequest(BaseModel):
    question_id: int
