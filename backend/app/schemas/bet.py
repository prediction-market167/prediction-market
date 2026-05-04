from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
from app.models.bet import BetSide, BetStatus


class BetCreate(BaseModel):
    market_id: int
    side: BetSide
    amount: Decimal


class BetResponse(BaseModel):
    id: int
    user_id: int
    market_id: int
    side: BetSide
    status: BetStatus
    amount: Decimal
    probability_at_bet: Decimal
    potential_payout: Decimal
    actual_payout: Decimal | None
    created_at: datetime

    model_config = {"from_attributes": True}
