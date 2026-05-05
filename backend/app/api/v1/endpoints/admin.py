import logging
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from app.db.session import get_db
from app.api.v1.deps import get_current_superuser
from app.models.user import User
from app.models.market import Market, MarketStatus
from app.models.bet import Bet, BetStatus
from app.models.star_payment import StarPayment, StarPaymentStatus
from app.models.transaction import Transaction, TransactionType
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
