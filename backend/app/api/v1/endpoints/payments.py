import math
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from telegram import LabeledPrice

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.market import Market, MarketStatus
from app.models.star_payment import StarPayment, StarPaymentStatus
from app.schemas.payment import (
    StarsInvoiceRequest, StarsInvoiceResponse,
    StarsVerifyRequest, StarsVerifyResponse,
)
from app.bot.application import get_application
from app.core.config import settings

router = APIRouter()


@router.post("/stars/invoice", response_model=StarsInvoiceResponse)
async def create_stars_invoice(
    req: StarsInvoiceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Telegram payments not configured")

    result = await db.execute(select(Market).where(Market.id == req.market_id))
    market = result.scalar_one_or_none()
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    if market.status != MarketStatus.OPEN:
        raise HTTPException(status_code=400, detail="Market is not open for betting")

    stars_amount = math.ceil(float(req.amount))  # 1 credit = 1 Star
    payload = str(uuid.uuid4())

    star_payment = StarPayment(
        payload=payload,
        user_id=current_user.id,
        market_id=market.id,
        side=req.side,
        stars_amount=stars_amount,
        bet_amount=req.amount,
    )
    db.add(star_payment)
    await db.flush()
    await db.refresh(star_payment)

    application = get_application()
    invoice_url = await application.bot.create_invoice_link(
        title=f"Bet — {market.title[:32]}",
        description=f"Predict {req.side.value.upper()} on market #{market.id}",
        payload=payload,
        currency="XTR",
        prices=[LabeledPrice("Bet", stars_amount)],
    )

    return StarsInvoiceResponse(
        payment_id=star_payment.id,
        invoice_url=invoice_url,
        stars_amount=stars_amount,
    )


@router.post("/stars/verify", response_model=StarsVerifyResponse)
async def verify_stars_payment(
    req: StarsVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(StarPayment).where(
            StarPayment.id == req.payment_id,
            StarPayment.user_id == current_user.id,
        )
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    return StarsVerifyResponse(
        payment_id=payment.id,
        status=payment.status,
        bet_id=payment.bet_id,
    )
