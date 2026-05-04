from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.market import Market, MarketStatus
from app.schemas.market import MarketCreate, MarketUpdate, MarketResponse, MarketResolve

router = APIRouter()


@router.get("/", response_model=List[MarketResponse])
async def list_markets(
    db: AsyncSession = Depends(get_db),
    status: MarketStatus | None = Query(None),
    category: str | None = Query(None),
    skip: int = 0,
    limit: int = 20,
):
    query = select(Market)
    if status:
        query = query.where(Market.status == status)
    if category:
        query = query.where(Market.category == category)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


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
    return market


@router.get("/{market_id}", response_model=MarketResponse)
async def get_market(market_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Market).where(Market.id == market_id))
    market = result.scalar_one_or_none()
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    return market


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
    return market


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
    if market.status != MarketStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Market must be closed before resolving")
    market.outcome = resolve_in.outcome
    market.status = MarketStatus.RESOLVED
    return market
