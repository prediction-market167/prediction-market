"""Core game logic: hourly question activation and 55-minute reveal/settle cycle."""
import logging
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

logger = logging.getLogger(__name__)

MIN_PARTICIPANTS = 20
REVEAL_AFTER_MINUTES = 55
BET_AMOUNT = Decimal("100")

# Prize pool allocation (must sum to 1.0)
WINNER_POOL_SHARE = Decimal("0.50")
JACKPOT_SHARE = Decimal("0.10")
MONTHLY_BONUS_SHARE = Decimal("0.10")
# REFERRAL_SHARE = 0.10  — paid per-bet at placement time
# ADMIN_PROFIT = 0.20    — retained by system (not distributed)

# Top-5 winner payouts (sum = 1.0 of winner pool)
WINNER_RANKS = [
    Decimal("0.40"),  # 1st
    Decimal("0.25"),  # 2nd
    Decimal("0.15"),  # 3rd
    Decimal("0.10"),  # 4th
    Decimal("0.10"),  # 5th
]


def _correct_side(correct_option_idx: int) -> str:
    mapping = {0: "yes", 1: "no", 2: "opt2", 3: "opt3"}
    return mapping.get(correct_option_idx, "yes")


async def _update_system_funds(jackpot_add: Decimal, monthly_add: Decimal, db: AsyncSession) -> None:
    from app.models.jackpot import SystemFunds
    funds_res = await db.execute(select(SystemFunds).where(SystemFunds.id == 1))
    funds = funds_res.scalar_one_or_none()
    if funds:
        funds.jackpot_balance += jackpot_add
        funds.monthly_bonus_balance += monthly_add
    else:
        db.add(SystemFunds(id=1, jackpot_balance=jackpot_add, monthly_bonus_balance=monthly_add))


async def activate_question_for_tier(tier, db: AsyncSession, creator_id: int):
    """Find next unused question for tier, create a market, return Market or None."""
    from app.models.question import Question, QuestionTier
    from app.models.market import Market, MarketStatus

    result = await db.execute(
        select(Question)
        .where(Question.tier == tier, Question.is_used == False)
        .order_by(Question.order_idx)
        .limit(1)
    )
    question = result.scalar_one_or_none()
    if not question:
        return None

    now = datetime.now(timezone.utc)
    close_date = now.replace(minute=55, second=0, microsecond=0)
    if now.minute >= 55:
        close_date = (now + timedelta(hours=1)).replace(minute=55, second=0, microsecond=0)

    options_all = {
        "mn": question.options_mn,
        "en": question.options_en or question.options_mn,
        "ru": question.options_ru or question.options_mn,
        "hi": question.options_hi or question.options_mn,
    }

    market = Market(
        title=question.question_mn,
        title_en=question.question_en or question.question_mn,
        title_ru=question.question_ru or question.question_mn,
        title_hi=question.question_hi or question.question_mn,
        description="",
        category=tier.value,
        tier=tier.value,
        creator_id=creator_id,
        status=MarketStatus.OPEN,
        options=options_all,
        correct_option_idx=question.correct_option_idx,
        question_id=question.id,
        close_date=close_date,
    )
    db.add(market)
    question.is_used = True
    await db.flush()
    await db.refresh(market)
    logger.info("Activated question %s as market %s (tier=%s)", question.id, market.id, tier.value)
    return market


async def reveal_or_cancel_open_markets(db: AsyncSession) -> None:
    """At :55 mark: reveal stats for markets >= MIN_PARTICIPANTS, cancel others."""
    from app.models.market import Market, MarketStatus
    from app.models.bet import Bet, BetStatus

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=REVEAL_AFTER_MINUTES)

    result = await db.execute(
        select(Market).where(
            Market.status == MarketStatus.OPEN,
            Market.revealed_at.is_(None),
            Market.tier.isnot(None),
            Market.created_at <= cutoff,
        )
    )
    markets = result.scalars().all()

    for market in markets:
        count_result = await db.execute(
            select(func.count(func.distinct(Bet.user_id))).where(
                Bet.market_id == market.id,
                Bet.status != BetStatus.CANCELLED,
            )
        )
        participant_count = count_result.scalar_one() or 0

        if market.tier != "free" and participant_count < MIN_PARTICIPANTS:
            await _cancel_market(market, db)
        else:
            await _settle_quiz_market(market, participant_count, db)


async def _cancel_market(market, db: AsyncSession) -> None:
    """Cancel market and refund all bets."""
    from app.models.market import MarketStatus
    from app.models.bet import Bet, BetStatus
    from app.models.user import User
    from app.models.transaction import Transaction, TransactionType
    from app.models.star_payment import StarPayment

    bets_result = await db.execute(
        select(Bet).where(Bet.market_id == market.id, Bet.status == BetStatus.ACTIVE)
    )
    bets = bets_result.scalars().all()

    for bet in bets:
        user_res = await db.execute(select(User).where(User.id == bet.user_id))
        user = user_res.scalar_one()
        before = user.balance
        user.balance += bet.amount
        db.add(Transaction(
            user_id=user.id, bet_id=bet.id,
            type=TransactionType.BET_REFUND,
            amount=bet.amount,
            balance_before=before,
            balance_after=user.balance,
            description=f"Auto-refund: market #{market.id} insufficient participants",
        ))
        bet.status = BetStatus.CANCELLED

        sp_res = await db.execute(select(StarPayment).where(StarPayment.bet_id == bet.id))
        sp = sp_res.scalar_one_or_none()
        if sp and sp.telegram_charge_id and user.telegram_id:
            try:
                from app.bot.application import get_application
                await get_application().bot.refund_star_payment(
                    user_telegram_id=user.telegram_id,
                    telegram_payment_charge_id=sp.telegram_charge_id,
                )
            except Exception as exc:
                logger.warning("Stars refund failed for sp %s: %s", sp.id, exc)

    market.status = MarketStatus.CANCELLED
    logger.info("Cancelled market %s: %d/%d participants", market.id, len(bets), MIN_PARTICIPANTS)


async def _settle_quiz_market(market, participant_count: int, db: AsyncSession) -> None:
    """
    Settle winners using prize distribution:
      50% winner pool → top 5 (40/25/15/10/10%)  ranked by correct answer + fastest time
      10% jackpot fund
      10% monthly bonus
      10% referral (paid per-bet at placement)
      20% admin profit (retained)
    """
    from app.models.market import MarketStatus, MarketOutcome
    from app.models.bet import Bet, BetStatus
    from app.models.user import User
    from app.models.transaction import Transaction, TransactionType

    correct_side = _correct_side(market.correct_option_idx)

    # Fetch bets sorted by created_at (fastest response = earliest timestamp)
    bets_result = await db.execute(
        select(Bet)
        .where(Bet.market_id == market.id, Bet.status == BetStatus.ACTIVE)
        .order_by(Bet.created_at)
    )
    bets = bets_result.scalars().all()

    total_pool = sum(b.amount for b in bets)
    winner_pool = total_pool * WINNER_POOL_SHARE
    jackpot_add = total_pool * JACKPOT_SHARE
    monthly_add = total_pool * MONTHLY_BONUS_SHARE

    correct_bets = [b for b in bets if b.side == correct_side]
    losing_bets = [b for b in bets if b.side != correct_side]

    # If no one got it right, winner pool rolls into jackpot
    if not correct_bets:
        jackpot_add += winner_pool
        winner_pool = Decimal("0")

    top_winners = correct_bets[:5]

    for rank, bet in enumerate(top_winners):
        share = WINNER_RANKS[rank]
        payout = Decimal(int(winner_pool * share))
        user_res = await db.execute(select(User).where(User.id == bet.user_id))
        user = user_res.scalar_one()
        before = user.balance
        user.balance += payout
        bet.status = BetStatus.WON
        bet.actual_payout = payout
        db.add(Transaction(
            user_id=user.id, bet_id=bet.id,
            type=TransactionType.BET_WON,
            amount=payout,
            balance_before=before,
            balance_after=user.balance,
            description=f"Quiz #{rank+1} place: market #{market.id} · {payout}⭐",
        ))

    # Correct bets beyond top 5 also get LOST (didn't make top 5)
    for bet in correct_bets[5:]:
        bet.status = BetStatus.LOST
        bet.actual_payout = Decimal("0")

    for bet in losing_bets:
        bet.status = BetStatus.LOST
        bet.actual_payout = Decimal("0")

    await _update_system_funds(jackpot_add, monthly_add, db)

    market.revealed_at = datetime.now(timezone.utc)
    market.status = MarketStatus.RESOLVED
    market.outcome = MarketOutcome.YES if correct_side == "yes" else MarketOutcome.NO

    logger.info(
        "Settled market %s: %d correct, top %d winners, jackpot+=%.0f, monthly+=%.0f",
        market.id, len(correct_bets), len(top_winners), jackpot_add, monthly_add,
    )


async def activate_all_tiers(db: AsyncSession, creator_id: int) -> None:
    """At :00 of each hour: create one new market per tier if none active this hour."""
    from app.models.market import Market, MarketStatus
    from app.models.question import QuestionTier

    now = datetime.now(timezone.utc)
    hour_start = now.replace(minute=0, second=0, microsecond=0)

    for tier in QuestionTier:
        existing = await db.execute(
            select(Market).where(
                Market.tier == tier.value,
                Market.status == MarketStatus.OPEN,
                Market.created_at >= hour_start,
            )
        )
        if existing.scalar_one_or_none():
            continue

        market = await activate_question_for_tier(tier, db, creator_id)
        if market is None:
            logger.warning("No unused questions for tier=%s", tier.value)
