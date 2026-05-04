from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.db.session import get_db
from app.api.v1.deps import get_current_superuser
from app.models.user import User
from app.models.market import Market, MarketStatus
from app.schemas.market import MarketCreate, MarketUpdate, MarketResponse, MarketResolve
from app.schemas.user import UserResponse, UserAdminUpdate

router = APIRouter()


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
    return result.scalars().all()


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
    return market


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
    return market


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
    return market


@router.delete("/markets/{market_id}", response_model=MarketResponse)
async def admin_cancel_market(
    market_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_superuser),
):
    result = await db.execute(select(Market).where(Market.id == market_id))
    market = result.scalar_one_or_none()
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    market.status = MarketStatus.CANCELLED
    return market


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
