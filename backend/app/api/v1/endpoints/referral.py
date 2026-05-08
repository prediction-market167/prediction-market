"""Referral system endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from decimal import Decimal
from typing import List

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.bet import Bet, BetStatus
from app.models.market import Market
from app.models.referral_ticket import ReferralTicket, TicketTier
from app.models.jackpot import SystemFunds
from app.core.config import settings

router = APIRouter()

MILESTONE_TIERS = [
    (3, TicketTier.EASY),
    (5, TicketTier.MEDIUM),
    (10, TicketTier.HARD),
]


class TicketOut(BaseModel):
    id: int
    tier: str
    is_used: bool
    created_at: str

    model_config = {"from_attributes": True}


class MilestoneOut(BaseModel):
    count: int
    tier: str


class ReferralInfoOut(BaseModel):
    referral_code: str | None
    referral_link: str
    active_referral_count: int
    lifetime_earnings: Decimal
    tickets: List[TicketOut]
    next_milestone: MilestoneOut | None


class JackpotOut(BaseModel):
    jackpot_balance: Decimal
    monthly_bonus_balance: Decimal


@router.get("/info", response_model=ReferralInfoOut)
async def get_referral_info(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Active referral count: referred users with at least 1 paid bet
    active_res = await db.execute(
        select(func.count(func.distinct(Bet.user_id)))
        .join(Market, Bet.market_id == Market.id)
        .join(User, Bet.user_id == User.id)
        .where(
            User.referred_by_id == current_user.id,
            Market.tier != "free",
            Market.tier.isnot(None),
            Bet.status != BetStatus.CANCELLED,
        )
    )
    active_count = active_res.scalar_one() or 0

    # Available (unused) tickets
    tickets_res = await db.execute(
        select(ReferralTicket).where(
            ReferralTicket.user_id == current_user.id,
            ReferralTicket.is_used == False,
        )
    )
    tickets = tickets_res.scalars().all()

    # Next milestone
    next_milestone = None
    for threshold, tier in MILESTONE_TIERS:
        if active_count < threshold:
            next_milestone = MilestoneOut(count=threshold, tier=tier.value)
            break

    code = current_user.referral_code or ""
    bot_username = settings.TELEGRAM_BOT_USERNAME or ""
    tg_id = current_user.telegram_id
    if tg_id and bot_username:
        link = f"https://t.me/{bot_username}?start=ref_{tg_id}"
    elif code:
        link = f"{settings.MINI_APP_URL}?startapp=ref_{code}"
    else:
        link = settings.MINI_APP_URL

    return ReferralInfoOut(
        referral_code=current_user.referral_code,
        referral_link=link,
        active_referral_count=active_count,
        lifetime_earnings=current_user.lifetime_referral_earnings,
        tickets=[
            TicketOut(
                id=t.id,
                tier=t.tier.value,
                is_used=t.is_used,
                created_at=t.created_at.isoformat(),
            )
            for t in tickets
        ],
        next_milestone=next_milestone,
    )


@router.get("/jackpot", response_model=JackpotOut)
async def get_jackpot(db: AsyncSession = Depends(get_db)):
    funds_res = await db.execute(select(SystemFunds).where(SystemFunds.id == 1))
    funds = funds_res.scalar_one_or_none()
    return JackpotOut(
        jackpot_balance=funds.jackpot_balance if funds else Decimal("0"),
        monthly_bonus_balance=funds.monthly_bonus_balance if funds else Decimal("0"),
    )
