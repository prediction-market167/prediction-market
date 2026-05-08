import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from decimal import Decimal

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.market import Market, MarketStatus
from app.models.bet import Bet, BetSide, BetStatus
from app.models.transaction import Transaction, TransactionType
from app.schemas.bet import BetCreate, BetResponse

logger = logging.getLogger(__name__)

router = APIRouter()

REFERRAL_BONUS_RATE = Decimal("0.10")

MILESTONE_TIERS = [
    (3, "easy"),
    (5, "medium"),
    (10, "hard"),
]


async def _issue_milestone_tickets(referrer: User, active_count: int, db: AsyncSession) -> None:
    """Issue a milestone ticket if a new threshold is crossed and not yet issued."""
    from app.models.referral_ticket import ReferralTicket, TicketTier

    for threshold, tier_str in MILESTONE_TIERS:
        if active_count >= threshold:
            tier = TicketTier(tier_str)
            existing = await db.execute(
                select(ReferralTicket).where(
                    ReferralTicket.user_id == referrer.id,
                    ReferralTicket.tier == tier,
                )
            )
            if not existing.scalar_one_or_none():
                db.add(ReferralTicket(user_id=referrer.id, tier=tier))
                logger.info("Issued %s ticket to user %s (milestone %d)", tier_str, referrer.id, threshold)


async def _count_active_referrals(referrer_id: int, db: AsyncSession) -> int:
    """Count referred users who have placed at least one bet in a paid (non-free) contest."""
    result = await db.execute(
        select(func.count(func.distinct(Bet.user_id)))
        .join(Market, Bet.market_id == Market.id)
        .join(User, Bet.user_id == User.id)
        .where(
            User.referred_by_id == referrer_id,
            Market.tier != "free",
            Market.tier.isnot(None),
            Bet.status != BetStatus.CANCELLED,
        )
    )
    return result.scalar_one() or 0


async def _notify_referrer(referrer: User, friend: User, earned: Decimal) -> None:
    """Send Telegram notification to referrer about earned bonus."""
    if not referrer.telegram_id:
        return
    try:
        from app.bot.application import get_application
        msg = (
            f"🎉 Your friend @{friend.username} joined a contest!\n"
            f"You earned {int(earned)} ⭐ referral bonus."
        )
        await get_application().bot.send_message(chat_id=referrer.telegram_id, text=msg)
    except Exception as exc:
        logger.warning("Referral notification failed for user %s: %s", referrer.id, exc)


async def _handle_referral_bonus(
    market: Market,
    current_user: User,
    bet_amount: Decimal,
    db: AsyncSession,
) -> None:
    """Pay 10% of bet amount to referrer when friend joins a paid contest."""
    if not market.tier or market.tier == "free":
        return
    if not current_user.referred_by_id:
        return

    referrer_res = await db.execute(select(User).where(User.id == current_user.referred_by_id))
    referrer = referrer_res.scalar_one_or_none()
    if not referrer:
        return

    bonus = Decimal(int(bet_amount * REFERRAL_BONUS_RATE))
    if bonus <= 0:
        return

    before = referrer.balance
    referrer.balance += bonus
    referrer.lifetime_referral_earnings += bonus

    db.add(Transaction(
        user_id=referrer.id,
        type=TransactionType.REFERRAL_BONUS,
        amount=bonus,
        balance_before=before,
        balance_after=referrer.balance,
        description=f"Referral bonus: @{current_user.username} joined market #{market.id}",
    ))

    active_count = await _count_active_referrals(referrer.id, db)
    await _issue_milestone_tickets(referrer, active_count, db)
    await _notify_referrer(referrer, current_user, bonus)


@router.post("/", response_model=BetResponse, status_code=status.HTTP_201_CREATED)
async def place_bet(
    bet_in: BetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Market).where(Market.id == bet_in.market_id))
    market = result.scalar_one_or_none()
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    if market.status != MarketStatus.OPEN:
        raise HTTPException(status_code=400, detail="Market is not open for betting")
    if current_user.balance < bet_in.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    prob = market.yes_probability if bet_in.side == BetSide.YES else market.no_probability
    potential_payout = bet_in.amount / prob

    balance_before = current_user.balance
    current_user.balance -= bet_in.amount
    market.total_volume += bet_in.amount

    bet = Bet(
        user_id=current_user.id,
        market_id=market.id,
        side=bet_in.side,
        amount=bet_in.amount,
        probability_at_bet=prob,
        potential_payout=potential_payout,
    )
    db.add(bet)

    tx = Transaction(
        user_id=current_user.id,
        type=TransactionType.BET_PLACED,
        amount=-bet_in.amount,
        balance_before=balance_before,
        balance_after=current_user.balance,
        description=f"Bet on market #{market.id} - {bet_in.side.value.upper()}",
    )
    db.add(tx)

    await _handle_referral_bonus(market, current_user, bet_in.amount, db)

    await db.flush()
    await db.refresh(bet)
    return bet


@router.get("/my", response_model=List[BetResponse])
async def my_bets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 20,
):
    result = await db.execute(
        select(Bet).where(Bet.user_id == current_user.id).order_by(Bet.created_at.desc()).offset(skip).limit(limit)
    )
    return result.scalars().all()
