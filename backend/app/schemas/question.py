from pydantic import BaseModel
from datetime import datetime
from app.models.question import QuestionTier, QuestionStatus, TranslationStatus


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
    status: QuestionStatus
    translation_status: TranslationStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class QuestionCountsResponse(BaseModel):
    unused: int
    scheduled_unused: int
    used: int


class QuestionUploadRow(BaseModel):
    tier: QuestionTier
    question_mn: str
    options_mn: list[str]
    correct_option_idx: int  # 0-based


class TranslationRequest(BaseModel):
    question_id: int


class GenerateRequest(BaseModel):
    category: str
    count: int


class GeneratedQuestionItem(BaseModel):
    tier: str
    question_mn: str
    question_en: str
    question_ru: str
    question_hi: str
    options_mn: list[str]
    options_en: list[str]
    options_ru: list[str]
    options_hi: list[str]
    correct_option_idx: int


class SaveBatchRequest(BaseModel):
    questions: list[GeneratedQuestionItem]
