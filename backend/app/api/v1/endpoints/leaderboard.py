from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from pydantic import BaseModel
from decimal import Decimal
from typing import List
from datetime import datetime, timezone, timedelta

from app.db.session import get_db
from app.models.user import User
from app.models.bet import Bet, BetStatus
from app.models.market import Market

router = APIRouter()


class LeaderboardEntry(BaseModel):
    rank: int
    username: str
    contest_count: int
    total_winnings: Decimal


@router.get("", response_model=List[LeaderboardEntry])
async def get_leaderboard(
    tier: str = Query(..., description="Tier: easy, medium, or hard"),
    db: AsyncSession = Depends(get_db),
):
    contest_count_col = func.count(func.distinct(Bet.market_id)).label("contest_count")
    winnings_col = func.coalesce(
        func.sum(
            case(
                (Bet.status == BetStatus.WON, Bet.actual_payout),
                else_=Decimal("0"),
            )
        ),
        Decimal("0"),
    ).label("total_winnings")

    stmt = (
        select(User.username, contest_count_col, winnings_col)
        .select_from(Bet)
        .join(Market, Bet.market_id == Market.id)
        .join(User, Bet.user_id == User.id)
        .where(
            Market.tier == tier,
            Bet.status != BetStatus.CANCELLED,
        )
        .group_by(User.id, User.username)
        .order_by(contest_count_col.desc(), winnings_col.desc())
        .limit(100)
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        LeaderboardEntry(
            rank=i + 1,
            username=row.username,
            contest_count=row.contest_count,
            total_winnings=row.total_winnings or Decimal("0"),
        )
        for i, row in enumerate(rows)
    ]


@router.get("/weekly", response_model=List[LeaderboardEntry])
async def get_weekly_leaderboard(
    tier: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    contest_count_col = func.count(func.distinct(Bet.market_id)).label("contest_count")
    winnings_col = func.coalesce(
        func.sum(case((Bet.status == BetStatus.WON, Bet.actual_payout), else_=Decimal("0"))),
        Decimal("0"),
    ).label("total_winnings")
    stmt = (
        select(User.username, contest_count_col, winnings_col)
        .select_from(Bet)
        .join(Market, Bet.market_id == Market.id)
        .join(User, Bet.user_id == User.id)
        .where(Market.tier == tier, Bet.status != BetStatus.CANCELLED, Market.close_date >= week_ago)
        .group_by(User.id, User.username)
        .order_by(contest_count_col.desc(), winnings_col.desc())
        .limit(3)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [LeaderboardEntry(rank=i+1, username=row.username, contest_count=row.contest_count, total_winnings=row.total_winnings or Decimal("0")) for i, row in enumerate(rows)]
