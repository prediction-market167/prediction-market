from pydantic import BaseModel, field_validator
from decimal import Decimal
from datetime import datetime
from typing import Any, List
from app.models.market import MarketStatus, MarketOutcome


class MarketBase(BaseModel):
    title: str
    description: str
    category: str
    close_date: datetime


class MarketCreate(MarketBase):
    pass


class MarketUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: MarketStatus | None = None


class MarketResolve(BaseModel):
    outcome: MarketOutcome


class MarketResponse(MarketBase):
    id: int
    creator_id: int
    status: MarketStatus
    outcome: MarketOutcome
    yes_probability: Decimal
    no_probability: Decimal
    total_volume: Decimal
    participant_count: int = 0
    refunded_count: int = 0

    # Quiz fields
    tier: str | None = None
    title_en: str | None = None
    title_ru: str | None = None
    title_hi: str | None = None
    options: dict | None = None          # {"mn": [...], "en": [...], ...}
    correct_option_idx: int | None = None  # hidden until revealed
    is_revealed: bool = False
    pool_status: str | None = None       # "gathering" | "threshold_met"
    question_id: int | None = None

    created_at: datetime

    model_config = {"from_attributes": True}


class MarketResultEntry(BaseModel):
    rank: int
    username: str
    option_idx: int
    elapsed_seconds: float
    is_correct: bool
    prize: Decimal
    is_you: bool


class MarketResultsResponse(BaseModel):
    total_participants: int
    correct_count: int
    prize_pool: Decimal
    your_rank: int | None
    entries: List[MarketResultEntry]
