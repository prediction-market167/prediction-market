from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from decimal import Decimal

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.market import Market, MarketStatus
from app.models.bet import Bet, BetSide
from app.models.transaction import Transaction, TransactionType
from app.schemas.bet import BetCreate, BetResponse

router = APIRouter()


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
        select(Bet).where(Bet.user_id == current_user.id).offset(skip).limit(limit)
    )
    return result.scalars().all()
