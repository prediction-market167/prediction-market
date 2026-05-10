import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings

logger = logging.getLogger(__name__)

GAME_SCHEDULER_INTERVAL = 30  # seconds between scheduler ticks


async def _get_system_creator_id() -> int | None:
    """Return the ID of the first superuser (used as market creator for auto-activated questions)."""
    from sqlalchemy import select
    from app.db.session import AsyncSessionLocal
    from app.models.user import User
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.is_superuser == True).order_by(User.id).limit(1)
        )
        user = result.scalar_one_or_none()
        return user.id if user else None


AUTO_GENERATE_HOUR_UTC = 3   # run at 03:00 UTC every day


async def _game_scheduler_loop() -> None:
    """
    Runs every GAME_SCHEDULER_INTERVAL seconds.
    - At minute 55: reveal stats or cancel markets with insufficient participants.
    - At minute 0-2: activate next question for each tier if not yet done this hour.
    - At AUTO_GENERATE_HOUR_UTC:00 — auto-generate 40 questions (10 per tier).
    """
    from app.db.session import AsyncSessionLocal
    from app.core.game import reveal_or_cancel_open_markets, activate_all_tiers

    last_reveal_hour: int   = -1
    last_activate_hour: int = -1
    last_autogen_day: int   = -1

    while True:
        await asyncio.sleep(GAME_SCHEDULER_INTERVAL)
        now = datetime.now(timezone.utc)
        current_minute = now.minute
        current_hour   = now.hour
        current_day    = now.timetuple().tm_yday  # day-of-year

        try:
            # :55 mark — reveal or cancel quiz markets
            if current_minute >= 55 and last_reveal_hour != current_hour:
                logger.info("Game scheduler: running reveal/cancel for hour %s", current_hour)
                async with AsyncSessionLocal() as db:
                    await reveal_or_cancel_open_markets(db)
                    await db.commit()
                last_reveal_hour = current_hour

            # :00 mark (minutes 0-2 to be safe with scheduler granularity)
            if current_minute <= 2 and last_activate_hour != current_hour:
                creator_id = await _get_system_creator_id()
                if creator_id:
                    logger.info("Game scheduler: activating hourly questions for hour %s", current_hour)
                    async with AsyncSessionLocal() as db:
                        await activate_all_tiers(db, creator_id)
                        await db.commit()
                last_activate_hour = current_hour

            # Daily auto-generation of 40 questions at AUTO_GENERATE_HOUR_UTC
            if current_hour == AUTO_GENERATE_HOUR_UTC and current_minute <= 2 and last_autogen_day != current_day:
                logger.info("Game scheduler: running daily question auto-generation")
                from app.core.question_generate import generate_questions_scheduled
                result = await generate_questions_scheduled(target_per_tier=10)
                logger.info("Daily auto-generation result: %s", result)
                last_autogen_day = current_day

        except Exception as exc:
            logger.error("Game scheduler error: %s", exc, exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler_task = asyncio.create_task(_game_scheduler_loop())
    logger.info("Game scheduler started (interval=%ds)", GAME_SCHEDULER_INTERVAL)

    if settings.TELEGRAM_BOT_TOKEN:
        from app.bot.application import get_application
        bot_app = get_application()
        await bot_app.initialize()
        logger.info("Telegram bot initialized")

    yield

    scheduler_task.cancel()
    try:
        await scheduler_task
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
