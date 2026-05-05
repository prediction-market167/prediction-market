from pydantic import BaseModel, field_validator
from decimal import Decimal
from app.models.bet import BetSide
from app.models.star_payment import StarPaymentStatus


class StarsInvoiceRequest(BaseModel):
    market_id: int
    side: BetSide
    amount: Decimal

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


class StarsInvoiceResponse(BaseModel):
    payment_id: int
    invoice_url: str
    stars_amount: int


class StarsVerifyRequest(BaseModel):
    payment_id: int


class StarsVerifyResponse(BaseModel):
    payment_id: int
    status: StarPaymentStatus
    bet_id: int | None = None

    model_config = {"from_attributes": True}
