import logging
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db
from app.api.v1.deps import get_current_superuser
from app.models.user import User
from app.models.market import Market, MarketStatus
from app.models.bet import Bet, BetStatus
from app.models.star_payment import StarPayment, StarPaymentStatus
from app.models.transaction import Transaction, TransactionType
from app.models.jackpot import SystemFunds
from app.models.jackpot_history import JackpotHistory
from app.schemas.market import MarketCreate, MarketUpdate, MarketResponse, MarketResolve
from app.schemas.user import UserResponse, UserAdminUpdate

logger = logging.getLogger(__name__)

router = APIRouter()

MIN_PARTICIPANTS = 20


async def _count_participants(market_id: int, db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count(func.distinct(Bet.user_id)))
        .where(Bet.market_id == market_id, Bet.status != BetStatus.CANCELLED)
    )
    return result.scalar_one() or 0


async def _refund_market_bets(market: Market, db: AsyncSession) -> int:
    """Refund all active bets on market. Returns number of bets refunded."""
    bets_result = await db.execute(
        select(Bet).where(Bet.market_id == market.id, Bet.status == BetStatus.ACTIVE)
    )
    bets = bets_result.scalars().all()

    for bet in bets:
        user_result = await db.execute(select(User).where(User.id == bet.user_id))
        user = user_result.scalar_one()

        balance_before = user.balance
        user.balance += bet.amount

        tx = Transaction(
            user_id=user.id,
            bet_id=bet.id,
            type=TransactionType.BET_REFUND,
            amount=bet.amount,
            balance_before=balance_before,
            balance_after=user.balance,
            description=f"Refund: market #{market.id} cancelled (insufficient participants)",
        )
        db.add(tx)
        bet.status = BetStatus.CANCELLED

        # Attempt Telegram Stars refund if applicable
        sp_result = await db.execute(
            select(StarPayment).where(StarPayment.bet_id == bet.id)
        )
        star_payment = sp_result.scalar_one_or_none()
        if star_payment and star_payment.telegram_charge_id and user.telegram_id:
            try:
                from app.bot.application import get_application
                app = get_application()
                await app.bot.refund_star_payment(
                    user_telegram_id=user.telegram_id,
                    telegram_payment_charge_id=star_payment.telegram_charge_id,
                )
                logger.info("Stars refunded for star_payment %s", star_payment.id)
            except Exception as e:
                logger.warning("Stars refund failed for star_payment %s: %s", star_payment.id, e)

    return len(bets)


async def _markets_with_counts(markets: list, db: AsyncSession) -> List[MarketResponse]:
    responses = []
    for market in markets:
        count = await _count_participants(market.id, db)
        r = MarketResponse.model_validate(market)
        r.participant_count = count
        responses.append(r)
    return responses


@router.get("/markets", response_model=List[MarketResponse])
async def admin_list_markets(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
    status: MarketStatus | None = Query(None),
    skip: int = 0,
    limit: int = 100,
):
    query = select(Market)
    if status:
        query = query.where(Market.status == status)
    query = query.order_by(Market.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    markets = result.scalars().all()
    return await _markets_with_counts(list(markets), db)


@router.post("/markets", response_model=MarketResponse, status_code=201)
async def admin_create_market(
    market_in: MarketCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    market = Market(**market_in.model_dump(), creator_id=current_user.id)
    db.add(market)
    await db.flush()
    await db.refresh(market)
    return MarketResponse.model_validate(market)


@router.patch("/markets/{market_id}", response_model=MarketResponse)
async def admin_update_market(
    market_id: int,
    market_in: MarketUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
):
    result = await db.execute(select(Market).where(Market.id == market_id))
    market = result.scalar_one_or_none()
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    for field, value in market_in.model_dump(exclude_unset=True).items():
        setattr(market, field, value)
    count = await _count_participants(market_id, db)
    r = MarketResponse.model_validate(market)
    r.participant_count = count
    return r


@router.post("/markets/{market_id}/close", response_model=MarketResponse)
async def admin_close_market(
    market_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
):
    """Close a market. If < MIN_PARTICIPANTS, auto-cancel with full refunds."""
    result = await db.execute(select(Market).where(Market.id == market_id))
    market = result.scalar_one_or_none()
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    if market.status != MarketStatus.OPEN:
        raise HTTPException(status_code=400, detail="Market must be open to close")

    participant_count = await _count_participants(market_id, db)

    if participant_count < MIN_PARTICIPANTS:
        refunded = await _refund_market_bets(market, db)
        market.status = MarketStatus.CANCELLED
        logger.info(
            "Market %s auto-cancelled: %d/%d participants, %d bets refunded",
            market_id, participant_count, MIN_PARTICIPANTS, refunded,
        )
    else:
        market.status = MarketStatus.CLOSED

    r = MarketResponse.model_validate(market)
    r.participant_count = participant_count
    return r


@router.post("/markets/{market_id}/resolve", response_model=MarketResponse)
async def admin_resolve_market(
    market_id: int,
    resolve_in: MarketResolve,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
):
    result = await db.execute(select(Market).where(Market.id == market_id))
    market = result.scalar_one_or_none()
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    market.outcome = resolve_in.outcome
    market.status = MarketStatus.RESOLVED
    count = await _count_participants(market_id, db)
    r = MarketResponse.model_validate(market)
    r.participant_count = count
    return r


@router.delete("/markets/{market_id}", response_model=MarketResponse)
async def admin_cancel_market(
    market_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
):
    """Force-cancel a market and refund all active bets."""
    result = await db.execute(select(Market).where(Market.id == market_id))
    market = result.scalar_one_or_none()
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    refunded = await _refund_market_bets(market, db)
    market.status = MarketStatus.CANCELLED
    logger.info("Market %s force-cancelled, %d bets refunded", market_id, refunded)
    r = MarketResponse.model_validate(market)
    r.participant_count = 0
    return r


@router.get("/users", response_model=List[UserResponse])
async def admin_list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
    skip: int = 0,
    limit: int = 100,
):
    result = await db.execute(
        select(User).order_by(User.created_at.desc()).offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.patch("/users/{user_id}", response_model=UserResponse)
async def admin_update_user(
    user_id: int,
    updates: UserAdminUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own account")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    return user


# ─── Platform Settings ────────────────────────────────────────────────────────

class SettingsOut(BaseModel):
    stars_to_ton_rate: Decimal


class SettingsUpdate(BaseModel):
    stars_to_ton_rate: Decimal | None = None


@router.get("/settings", response_model=SettingsOut)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
):
    result = await db.execute(select(SystemFunds).where(SystemFunds.id == 1))
    funds = result.scalar_one_or_none()
    return SettingsOut(stars_to_ton_rate=funds.stars_to_ton_rate if funds else Decimal("100"))


@router.patch("/settings", response_model=SettingsOut)
async def update_settings(
    body: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
):
    result = await db.execute(select(SystemFunds).where(SystemFunds.id == 1))
    funds = result.scalar_one_or_none()
    if not funds:
        raise HTTPException(status_code=404, detail="System funds not initialised")
    if body.stars_to_ton_rate is not None:
        if body.stars_to_ton_rate <= 0:
            raise HTTPException(status_code=400, detail="Rate must be positive")
        funds.stars_to_ton_rate = body.stars_to_ton_rate
    return SettingsOut(stars_to_ton_rate=funds.stars_to_ton_rate)


# ─── Jackpot ─────────────────────────────────────────────────────────────────

class JackpotCriteria(BaseModel):
    type: Literal["contest_count", "leaderboard"]
    min_contests: int | None = None
    days: int | None = None
    tier: str | None = None
    top_x: int | None = None


class JackpotHistoryOut(BaseModel):
    id: int
    winner_username: str
    amount: Decimal
    criteria: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class JackpotTriggerResult(BaseModel):
    winner_username: str
    amount: Decimal
    eligible_count: int


async def _get_eligible_user_ids(criteria: JackpotCriteria, db: AsyncSession) -> list[int]:
    if criteria.type == "contest_count":
        if not criteria.min_contests or not criteria.days:
            return []
        cutoff = datetime.now(timezone.utc) - timedelta(days=criteria.days)
        stmt = (
            select(Bet.user_id)
            .join(Market, Bet.market_id == Market.id)
            .join(User, Bet.user_id == User.id)
            .where(
                Market.tier.isnot(None),
                Market.tier != "free",
                Bet.status != BetStatus.CANCELLED,
                Bet.created_at >= cutoff,
                User.is_active == True,
            )
            .group_by(Bet.user_id)
            .having(func.count(func.distinct(Bet.market_id)) >= criteria.min_contests)
        )
        result = await db.execute(stmt)
        return [row[0] for row in result.all()]

    elif criteria.type == "leaderboard":
        if not criteria.tier or not criteria.top_x:
            return []
        stmt = (
            select(Bet.user_id)
            .select_from(Bet)
            .join(Market, Bet.market_id == Market.id)
            .join(User, Bet.user_id == User.id)
            .where(
                Market.tier == criteria.tier,
                Bet.status != BetStatus.CANCELLED,
                User.is_active == True,
            )
            .group_by(Bet.user_id)
            .order_by(func.count(func.distinct(Bet.market_id)).desc())
            .limit(criteria.top_x)
        )
        result = await db.execute(stmt)
        return [row[0] for row in result.all()]

    return []


@router.get("/jackpot/eligible-count")
async def jackpot_eligible_count(
    type: str = Query(...),
    min_contests: int | None = Query(None),
    days: int | None = Query(None),
    tier: str | None = Query(None),
    top_x: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
):
    criteria = JackpotCriteria(type=type, min_contests=min_contests, days=days, tier=tier, top_x=top_x)  # type: ignore[arg-type]
    ids = await _get_eligible_user_ids(criteria, db)
    return {"count": len(ids)}


@router.post("/jackpot/trigger", response_model=JackpotTriggerResult)
async def trigger_jackpot(
    criteria: JackpotCriteria,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    funds_res = await db.execute(select(SystemFunds).where(SystemFunds.id == 1))
    funds = funds_res.scalar_one_or_none()
    if not funds or funds.jackpot_balance <= 0:
        raise HTTPException(status_code=400, detail="No jackpot balance available")

    user_ids = await _get_eligible_user_ids(criteria, db)
    if not user_ids:
        raise HTTPException(status_code=400, detail="No eligible users found")

    winner_id = random.choice(user_ids)
    winner_res = await db.execute(select(User).where(User.id == winner_id))
    winner = winner_res.scalar_one()

    amount = funds.jackpot_balance
    balance_before = winner.balance
    winner.balance += amount
    funds.jackpot_balance = Decimal("0.00")

    tx = Transaction(
        user_id=winner.id,
        type=TransactionType.JACKPOT,
        amount=amount,
        balance_before=balance_before,
        balance_after=winner.balance,
        description=f"Surprise Jackpot winner — {amount} ⭐",
    )
    db.add(tx)

    history = JackpotHistory(
        winner_id=winner.id,
        winner_username=winner.username,
        amount=amount,
        criteria=criteria.model_dump(),
        triggered_by_id=current_user.id,
    )
    db.add(history)
    await db.flush()

    if winner.telegram_id:
        try:
            from app.bot.application import get_application
            app = get_application()
            await app.bot.send_message(
                chat_id=winner.telegram_id,
                text=(
                    f"🎉 Congratulations! You won the Surprise Jackpot!\n\n"
                    f"⭐ {int(amount)} Stars have been credited to your account.\n\n"
                    f"Keep competing to win more!"
                ),
            )
        except Exception as e:
            logger.warning("Jackpot notification failed for user %s: %s", winner.id, e)

    logger.info("Jackpot triggered: %s ⭐ awarded to %s (id=%s)", amount, winner.username, winner.id)
    return JackpotTriggerResult(
        winner_username=winner.username,
        amount=amount,
        eligible_count=len(user_ids),
    )


@router.get("/jackpot/history", response_model=List[JackpotHistoryOut])
async def jackpot_history(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
):
    result = await db.execute(
        select(JackpotHistory).order_by(JackpotHistory.created_at.desc()).limit(50)
    )
    return result.scalars().all()


# ─── Broadcast ───────────────────────────────────────────────────────────────

class BroadcastRequest(BaseModel):
    message: str


@router.post("/broadcast")
async def broadcast_notification(
    body: BroadcastRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
):
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    result = await db.execute(
        select(User).where(User.telegram_id.isnot(None), User.is_active == True)
    )
    users = result.scalars().all()

    try:
        from app.bot.application import get_application
        bot = get_application().bot
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Telegram bot not configured: {e}")

    sent = 0
    for user in users:
        try:
            await bot.send_message(chat_id=user.telegram_id, text=body.message)
            sent += 1
        except Exception as e:
            logger.debug("Broadcast failed for user %s: %s", user.id, e)

    logger.info("Broadcast sent to %d/%d users", sent, len(users))
    return {"sent": sent, "total": len(users)}
