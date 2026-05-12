"""Core game logic: hourly question activation and 55-minute reveal/settle cycle."""
import logging
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

logger = logging.getLogger(__name__)

MIN_PARTICIPANTS = 10
REVEAL_AFTER_MINUTES = 55
BET_AMOUNT = Decimal("100")  # legacy fallback

TIER_ENTRY_FEE: dict[str, Decimal] = {
    "free": Decimal("0"),
    "easy": Decimal("20"),
    "medium": Decimal("50"),
    "hard": Decimal("100"),
}

# Prize pool allocation (must sum to 1.0)
WINNER_POOL_SHARE = Decimal("0.70")
JACKPOT_SHARE = Decimal("0.10")
# REFERRAL_SHARE = 0.10  — paid per-bet at placement time (→ platform if no referrer)
# ADMIN_PROFIT = 0.10    — retained by system (not distributed)

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


async def _get_system_funds(db: AsyncSession):
    from app.models.jackpot import SystemFunds
    funds_res = await db.execute(select(SystemFunds).where(SystemFunds.id == 1))
    return funds_res.scalar_one_or_none()


async def activate_question_for_tier(tier, db: AsyncSession, creator_id: int):
    """Find next question for tier (scheduled_unused first, then unused), create market."""
    from app.models.question import Question, QuestionTier, QuestionStatus
    from app.models.market import Market, MarketStatus

    # Prefer recycled (scheduled_unused) questions first, then fresh unused ones
    question = None
    for status in (QuestionStatus.scheduled_unused, QuestionStatus.unused):
        res = await db.execute(
            select(Question)
            .where(Question.tier == tier, Question.status == status)
            .order_by(Question.order_idx)
            .limit(1)
        )
        question = res.scalar_one_or_none()
        if question:
            break
    if not question:
        return None

    now = datetime.now(timezone.utc)
    close_date = now.replace(minute=55, second=0, microsecond=0)
    if now.minute >= 55:
        close_date = (now + timedelta(hours=1)).replace(minute=55, second=0, microsecond=0)

    def _opts(v):
        if isinstance(v, str):
            import json as _json
            try:
                return _json.loads(v)
            except Exception:
                return v
        return v

    options_all = {
        "mn": _opts(question.options_mn),
        "en": _opts(question.options_en or question.options_mn),
        "ru": _opts(question.options_ru or question.options_mn),
        "hi": _opts(question.options_hi or question.options_mn),
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
    from app.models.question import QuestionStatus
    question.is_used = True  # kept for backward compatibility
    question.status = QuestionStatus.scheduled_unused
    await db.flush()
    await db.refresh(market)
    logger.info("Activated question %s as market %s (tier=%s)", question.id, market.id, tier.value)
    return market


async def reveal_or_cancel_open_markets(db: AsyncSession) -> None:
    """At :55 mark: reveal stats for markets >= MIN_PARTICIPANTS, cancel others."""
    from app.models.market import Market, MarketStatus
    from app.models.bet import Bet, BetStatus

    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(Market).where(
            Market.status == MarketStatus.OPEN,
            Market.revealed_at.is_(None),
            Market.tier.isnot(None),
            Market.close_date <= now,
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
    """Cancel market and refund all bets. Reverses ledger credits."""
    from app.models.market import MarketStatus
    from app.models.bet import Bet, BetStatus
    from app.models.user import User
    from app.models.transaction import Transaction, TransactionType
    from app.models.star_payment import StarPayment

    bets_result = await db.execute(
        select(Bet).where(Bet.market_id == market.id, Bet.status == BetStatus.ACTIVE)
    )
    bets = bets_result.scalars().all()

    funds = await _get_system_funds(db)

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

        # Reverse ledger credits for this refunded bet
        if funds and bet.amount > 0:
            has_referrer = bool(user.referred_by_id)
            funds.prize_pool_balance = max(Decimal("0"), funds.prize_pool_balance - bet.amount * Decimal("0.70"))
            funds.jackpot_balance = max(Decimal("0"), funds.jackpot_balance - bet.amount * Decimal("0.10"))
            if has_referrer:
                funds.referral_pool_balance = max(Decimal("0"), funds.referral_pool_balance - bet.amount * Decimal("0.10"))
                funds.admin_profit_balance = max(Decimal("0"), funds.admin_profit_balance - bet.amount * Decimal("0.10"))
            else:
                funds.admin_profit_balance = max(Decimal("0"), funds.admin_profit_balance - bet.amount * Decimal("0.20"))

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

    # Update question status: recyclable if 0 paid participants, used otherwise
    if market.question_id:
        from app.models.question import Question, QuestionStatus
        q_res = await db.execute(select(Question).where(Question.id == market.question_id))
        cancelled_question = q_res.scalar_one_or_none()
        if cancelled_question:
            if len(bets) == 0:
                # No one saw/answered — safe to recycle
                cancelled_question.status = QuestionStatus.scheduled_unused
                cancelled_question.is_used = False
            else:
                # At least one paid participant saw it — mark as used
                cancelled_question.status = QuestionStatus.used
                cancelled_question.is_used = True

    # Notify participants of refund (fire-and-forget)
    for bet in bets:
        if bet.amount > 0:
            user_res = await db.execute(select(User).where(User.id == bet.user_id))
            refunded_user = user_res.scalar_one()
            if refunded_user.telegram_id:
                try:
                    from app.bot.application import send_refund_notification
                    await send_refund_notification(
                        refunded_user.telegram_id, int(bet.amount), market.id,
                        lang=refunded_user.language_code,
                    )
                except Exception as exc:
                    logger.warning("Refund notification error user=%d: %s", bet.user_id, exc)


async def _settle_quiz_market(market, participant_count: int, db: AsyncSession) -> None:
    """
    Settle winners using prize distribution:
      70% winner pool → top 5 (40/25/15/10/10%)  ranked by correct answer + fastest time
      10% jackpot fund
      10% referral (paid per-bet at placement; → platform if no referrer)
      10% platform fee (retained)
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

    correct_bets = [b for b in bets if b.side == correct_side]
    losing_bets = [b for b in bets if b.side != correct_side]

    funds = await _get_system_funds(db)

    # If no one got it right, winner pool rolls into jackpot
    if not correct_bets:
        if funds:
            funds.jackpot_balance += winner_pool
            funds.prize_pool_balance = max(Decimal("0"), funds.prize_pool_balance - winner_pool)
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

    # Deduct winner payouts from prize pool ledger
    if funds and winner_pool > 0:
        funds.prize_pool_balance = max(Decimal("0"), funds.prize_pool_balance - winner_pool)

    # Correct bets beyond top 5 also get LOST (didn't make top 5)
    for bet in correct_bets[5:]:
        bet.status = BetStatus.LOST
        bet.actual_payout = Decimal("0")

    for bet in losing_bets:
        bet.status = BetStatus.LOST
        bet.actual_payout = Decimal("0")

    market.revealed_at = datetime.now(timezone.utc)
    market.status = MarketStatus.RESOLVED
    # For binary markets correct_side is "yes"/"no"; multi-option uses "opt2"/"opt3".
    # MarketOutcome only has YES/NO — use YES for option-0 wins, NO for option-1,
    # and leave UNRESOLVED for opt2/opt3 (correct_option_idx is the authoritative field).
    if correct_side == "yes":
        market.outcome = MarketOutcome.YES
    elif correct_side == "no":
        market.outcome = MarketOutcome.NO
    # else: leave as UNRESOLVED — frontend uses correct_option_idx for display

    # Mark question as permanently used (was shown to ≥1 paid participant)
    if market.question_id:
        from app.models.question import Question, QuestionStatus
        q_res = await db.execute(select(Question).where(Question.id == market.question_id))
        settled_question = q_res.scalar_one_or_none()
        if settled_question:
            settled_question.status = QuestionStatus.used
            settled_question.is_used = True

    logger.info(
        "Settled market %s: %d correct, top %d winners",
        market.id, len(correct_bets), len(top_winners),
    )

    # Send Telegram notifications (fire-and-forget)
    winner_user_ids = {bet.user_id for bet in top_winners}

    for rank, bet in enumerate(top_winners):
        user_res = await db.execute(select(User).where(User.id == bet.user_id))
        winner_user = user_res.scalar_one()
        if winner_user.telegram_id:
            payout = int(bet.actual_payout or 0)
            try:
                from app.bot.application import send_winner_notification
                await send_winner_notification(winner_user.telegram_id, rank + 1, payout, market.id, lang=winner_user.language_code)
            except Exception as exc:
                logger.warning("Winner notification error rank=%d: %s", rank + 1, exc)

    all_losing_bets = [b for b in bets if b.user_id not in winner_user_ids]
    for bet in all_losing_bets:
        user_res = await db.execute(select(User).where(User.id == bet.user_id))
        losing_user = user_res.scalar_one()
        if losing_user.telegram_id:
            try:
                from app.bot.application import send_loss_notification
                await send_loss_notification(losing_user.telegram_id, lang=losing_user.language_code)
            except Exception as exc:
                logger.warning("Loss notification error user=%d: %s", bet.user_id, exc)


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
