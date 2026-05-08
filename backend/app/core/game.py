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


def _correct_side(correct_option_idx: int) -> str:
    mapping = {0: "yes", 1: "no", 2: "opt2", 3: "opt3"}
    return mapping.get(correct_option_idx, "yes")


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
    # close_date = :55 of the current hour
    close_date = now.replace(minute=55, second=0, microsecond=0)
    if now.minute >= 55:
        # already past :55 this hour — schedule for next hour's :55
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
    """At :55 mark: reveal stats for markets ≥ MIN_PARTICIPANTS, cancel others."""
    from app.models.market import Market, MarketStatus
    from app.models.bet import Bet, BetStatus
    from app.models.user import User
    from app.models.transaction import Transaction, TransactionType
    from app.models.star_payment import StarPayment

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=REVEAL_AFTER_MINUTES)

    result = await db.execute(
        select(Market).where(
            Market.status == MarketStatus.OPEN,
            Market.revealed_at.is_(None),
            Market.tier.isnot(None),      # only quiz markets
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

        if participant_count < MIN_PARTICIPANTS:
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
    """Reveal stats and settle winnings for a quiz market at the :55 mark."""
    from app.models.market import MarketStatus, MarketOutcome
    from app.models.bet import Bet, BetStatus
    from app.models.user import User
    from app.models.transaction import Transaction, TransactionType

    correct_side = _correct_side(market.correct_option_idx)

    # Fetch all active bets
    bets_result = await db.execute(
        select(Bet).where(Bet.market_id == market.id, Bet.status == BetStatus.ACTIVE)
    )
    bets = bets_result.scalars().all()

    total_pool = BET_AMOUNT * len(bets)
    winners = [b for b in bets if b.side == correct_side]
    losers = [b for b in bets if b.side != correct_side]

    if winners:
        payout_each = Decimal(int(total_pool / len(winners)))
    else:
        payout_each = Decimal("0")

    for bet in winners:
        user_res = await db.execute(select(User).where(User.id == bet.user_id))
        user = user_res.scalar_one()
        before = user.balance
        user.balance += payout_each
        bet.status = BetStatus.WON
        bet.actual_payout = payout_each
        db.add(Transaction(
            user_id=user.id, bet_id=bet.id,
            type=TransactionType.BET_WON,
            amount=payout_each,
            balance_before=before,
            balance_after=user.balance,
            description=f"Quiz win: market #{market.id} · {payout_each}⭐",
        ))

    for bet in losers:
        bet.status = BetStatus.LOST
        bet.actual_payout = Decimal("0")

    market.revealed_at = datetime.now(timezone.utc)
    market.status = MarketStatus.RESOLVED
    market.outcome = MarketOutcome.YES if correct_side == "yes" else MarketOutcome.NO

    logger.info(
        "Settled market %s: %d winners, %d losers, payout=%s each",
        market.id, len(winners), len(losers), payout_each,
    )


async def activate_all_tiers(db: AsyncSession, creator_id: int) -> None:
    """At :00 of each hour: create one new market per tier if none active this hour."""
    from app.models.market import Market, MarketStatus
    from app.models.question import QuestionTier

    now = datetime.now(timezone.utc)
    hour_start = now.replace(minute=0, second=0, microsecond=0)

    for tier in QuestionTier:
        # Check if there's already an open market for this tier created this hour
        existing = await db.execute(
            select(Market).where(
                Market.tier == tier.value,
                Market.status == MarketStatus.OPEN,
                Market.created_at >= hour_start,
            )
        )
        if existing.scalar_one_or_none():
            continue  # already active for this hour

        market = await activate_question_for_tier(tier, db, creator_id)
        if market is None:
            logger.warning("No unused questions for tier=%s", tier.value)
