from pydantic import BaseModel, field_validator
from decimal import Decimal
from datetime import datetime
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
    created_at: datetime

    model_config = {"from_attributes": True}
