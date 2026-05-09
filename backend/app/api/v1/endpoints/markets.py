from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.bet import SIDE_TO_OPTION_IDX
from app.models.market import Market, MarketStatus
from app.models.bet import Bet, BetStatus
from app.schemas.market import MarketCreate, MarketUpdate, MarketResponse, MarketResolve, MarketResultEntry, MarketResultsResponse

router = APIRouter()

MIN_PARTICIPANTS = 20


def _apply_dark_pool(response: MarketResponse, participant_count: int) -> MarketResponse:
    """Hide stats if market is in dark pool phase (open quiz market, not yet revealed)."""
    if (
        response.tier is not None
        and response.status == "open"
        and not response.is_revealed
    ):
        # Determine pool_status without revealing count
        response.pool_status = "threshold_met" if participant_count >= MIN_PARTICIPANTS else "gathering"
        response.participant_count = 0
        response.yes_probability = Decimal("0.5000")
        response.no_probability = Decimal("0.5000")
        response.correct_option_idx = None  # hidden until revealed
    else:
        response.participant_count = participant_count
        response.is_revealed = True
    return response


def _build_response(market: Market, participant_count: int) -> MarketResponse:
    r = MarketResponse.model_validate(market)
    r.is_revealed = market.revealed_at is not None or market.status != MarketStatus.OPEN
    return _apply_dark_pool(r, participant_count)


@router.get("/", response_model=List[MarketResponse])
async def list_markets(
    db: AsyncSession = Depends(get_db),
    status: MarketStatus | None = Query(None),
    category: str | None = Query(None),
    tier: str | None = Query(None),
    skip: int = 0,
    limit: int = 20,
):
    query = select(Market)
    if status:
        query = query.where(Market.status == status)
    if category:
        query = query.where(Market.category == category)
    if tier:
        query = query.where(Market.tier == tier)
    query = query.order_by(Market.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    markets = result.scalars().all()

    responses = []
    for market in markets:
        count_res = await db.execute(
            select(func.count(func.distinct(Bet.user_id)))
            .where(Bet.market_id == market.id, Bet.status != BetStatus.CANCELLED)
        )
        participant_count = count_res.scalar_one() or 0
        responses.append(_build_response(market, participant_count))
    return responses


@router.post("/", response_model=MarketResponse, status_code=status.HTTP_201_CREATED)
async def create_market(
    market_in: MarketCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    market = Market(**market_in.model_dump(), creator_id=current_user.id)
    db.add(market)
    await db.flush()
    await db.refresh(market)
    return _build_response(market, 0)


@router.get("/{market_id}", response_model=MarketResponse)
async def get_market(market_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Market).where(Market.id == market_id))
    market = result.scalar_one_or_none()
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")

    count_result = await db.execute(
        select(func.count(func.distinct(Bet.user_id)))
        .where(Bet.market_id == market_id, Bet.status != BetStatus.CANCELLED)
    )
    participant_count = count_result.scalar_one() or 0
    return _build_response(market, participant_count)


_WINNER_SHARES = [Decimal("0.40"), Decimal("0.25"), Decimal("0.15"), Decimal("0.10"), Decimal("0.10")]
_IDX_TO_SIDE = {0: "yes", 1: "no", 2: "opt2", 3: "opt3"}
_SIDE_TO_IDX = {v: k for k, v in _IDX_TO_SIDE.items()}


@router.get("/{market_id}/results", response_model=MarketResultsResponse)
async def market_results(
    market_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mkt_res = await db.execute(select(Market).where(Market.id == market_id))
    market = mkt_res.scalar_one_or_none()
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    if market.status == MarketStatus.OPEN and not market.revealed_at:
        raise HTTPException(status_code=403, detail="Results not yet revealed")

    correct_side = _IDX_TO_SIDE.get(market.correct_option_idx, "yes") if market.correct_option_idx is not None else None

    bets_result = await db.execute(
        select(Bet, User)
        .join(User, Bet.user_id == User.id)
        .where(Bet.market_id == market_id, Bet.status != BetStatus.CANCELLED)
        .order_by(Bet.created_at)
    )
    rows = bets_result.all()

    correct_rows = [(b, u) for b, u in rows if correct_side and b.side.value == correct_side]
    incorrect_rows = [(b, u) for b, u in rows if not correct_side or b.side.value != correct_side]

    total_pool = sum(b.amount for b, _ in rows)
    winner_pool = total_pool * Decimal("0.50")

    market_start = market.created_at.replace(tzinfo=timezone.utc) if market.created_at.tzinfo is None else market.created_at

    entries: list[MarketResultEntry] = []
    your_rank: int | None = None

    for rank_0, (bet, user) in enumerate(correct_rows):
        rank = rank_0 + 1
        prize = Decimal(int(winner_pool * _WINNER_SHARES[rank_0])) if rank_0 < 5 else Decimal("0")
        bet_time = bet.created_at.replace(tzinfo=timezone.utc) if bet.created_at.tzinfo is None else bet.created_at
        elapsed = max(0.0, (bet_time - market_start).total_seconds())
        is_you = user.id == current_user.id
        if is_you:
            your_rank = rank
        entries.append(MarketResultEntry(
            rank=rank,
            username=user.username or f"Player{user.id}",
            option_idx=_SIDE_TO_IDX.get(bet.side.value, 0),
            elapsed_seconds=elapsed,
            is_correct=True,
            prize=prize,
            is_you=is_you,
        ))

    for rank_0, (bet, user) in enumerate(incorrect_rows):
        rank = len(correct_rows) + rank_0 + 1
        bet_time = bet.created_at.replace(tzinfo=timezone.utc) if bet.created_at.tzinfo is None else bet.created_at
        elapsed = max(0.0, (bet_time - market_start).total_seconds())
        is_you = user.id == current_user.id
        entries.append(MarketResultEntry(
            rank=rank,
            username=user.username or f"Player{user.id}",
            option_idx=_SIDE_TO_IDX.get(bet.side.value, 0),
            elapsed_seconds=elapsed,
            is_correct=False,
            prize=Decimal("0"),
            is_you=is_you,
        ))

    return MarketResultsResponse(
        total_participants=len(rows),
        correct_count=len(correct_rows),
        prize_pool=winner_pool,
        your_rank=your_rank,
        entries=entries,
    )


@router.patch("/{market_id}", response_model=MarketResponse)
async def update_market(
    market_id: int,
    market_in: MarketUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Market).where(Market.id == market_id))
    market = result.scalar_one_or_none()
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    if market.creator_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough privileges")
    for field, value in market_in.model_dump(exclude_unset=True).items():
        setattr(market, field, value)
    return _build_response(market, 0)


@router.post("/{market_id}/resolve", response_model=MarketResponse)
async def resolve_market(
    market_id: int,
    resolve_in: MarketResolve,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Market).where(Market.id == market_id))
    market = result.scalar_one_or_none()
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    if market.creator_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough privileges")
    if market.status not in (MarketStatus.CLOSED, MarketStatus.OPEN):
        raise HTTPException(status_code=400, detail="Market cannot be resolved in its current state")
    market.outcome = resolve_in.outcome
    market.status = MarketStatus.RESOLVED
    market.revealed_at = datetime.now(timezone.utc)
    count_result = await db.execute(
        select(func.count(func.distinct(Bet.user_id)))
        .where(Bet.market_id == market_id, Bet.status != BetStatus.CANCELLED)
    )
    participant_count = count_result.scalar_one() or 0
    return _build_response(market, participant_count)
