import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings

logger = logging.getLogger(__name__)

MIN_PARTICIPANTS = 20
AUTO_CANCEL_AFTER_HOURS = 1
AUTO_CANCEL_CHECK_INTERVAL = 60  # seconds


async def _auto_cancel_expired_markets() -> None:
    """Cancel OPEN markets older than 1 hour that haven't reached 20 participants."""
    from sqlalchemy import select, func
    from app.db.session import AsyncSessionLocal
    from app.models.market import Market, MarketStatus
    from app.models.bet import Bet, BetStatus
    from app.models.user import User
    from app.models.transaction import Transaction, TransactionType
    from app.models.star_payment import StarPayment

    deadline = datetime.now(timezone.utc) - timedelta(hours=AUTO_CANCEL_AFTER_HOURS)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Market).where(
                Market.status == MarketStatus.OPEN,
                Market.created_at <= deadline,
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

            if participant_count >= MIN_PARTICIPANTS:
                continue

            # Refund all active bets and cancel market
            bets_result = await db.execute(
                select(Bet).where(
                    Bet.market_id == market.id,
                    Bet.status == BetStatus.ACTIVE,
                )
            )
            bets = bets_result.scalars().all()

            for bet in bets:
                user_result = await db.execute(select(User).where(User.id == bet.user_id))
                user = user_result.scalar_one()

                balance_before = user.balance
                user.balance += bet.amount

                db.add(Transaction(
                    user_id=user.id,
                    bet_id=bet.id,
                    type=TransactionType.BET_REFUND,
                    amount=bet.amount,
                    balance_before=balance_before,
                    balance_after=user.balance,
                    description=f"Auto-refund: market #{market.id} cancelled (1 h, <{MIN_PARTICIPANTS} participants)",
                ))
                bet.status = BetStatus.CANCELLED

                # Attempt Telegram Stars refund
                sp_result = await db.execute(
                    select(StarPayment).where(StarPayment.bet_id == bet.id)
                )
                star_payment = sp_result.scalar_one_or_none()
                if star_payment and star_payment.telegram_charge_id and user.telegram_id:
                    try:
                        from app.bot.application import get_application
                        await (get_application()).bot.refund_star_payment(
                            user_telegram_id=user.telegram_id,
                            telegram_payment_charge_id=star_payment.telegram_charge_id,
                        )
                        logger.info("Stars auto-refunded for star_payment %s", star_payment.id)
                    except Exception as exc:
                        logger.warning(
                            "Stars auto-refund failed for star_payment %s: %s",
                            star_payment.id, exc,
                        )

            market.status = MarketStatus.CANCELLED
            logger.info(
                "Auto-cancelled market %s: %d/%d participants, %d bets refunded",
                market.id, participant_count, MIN_PARTICIPANTS, len(bets),
            )

        await db.commit()


async def _auto_cancel_loop() -> None:
    """Run the auto-cancel check every AUTO_CANCEL_CHECK_INTERVAL seconds."""
    while True:
        await asyncio.sleep(AUTO_CANCEL_CHECK_INTERVAL)
        try:
            await _auto_cancel_expired_markets()
        except Exception as exc:
            logger.error("Auto-cancel loop error: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    cancel_task = asyncio.create_task(_auto_cancel_loop())
    logger.info("Auto-cancel background task started (interval=%ds)", AUTO_CANCEL_CHECK_INTERVAL)

    if settings.TELEGRAM_BOT_TOKEN:
        from app.bot.application import get_application
        bot_app = get_application()
        await bot_app.initialize()
        logger.info("Telegram bot initialized")

    yield

    cancel_task.cancel()
    try:
        await cancel_task
    except asyncio.CancelledError:
        pass

    if settings.TELEGRAM_BOT_TOKEN:
        from app.bot.application import get_application
        bot_app = get_application()
        await bot_app.shutdown()
        logger.info("Telegram bot shut down")


app = FastAPI(
    title=settings.APP_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
