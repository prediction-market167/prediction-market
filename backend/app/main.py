import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import settings

logger = logging.getLogger(__name__)

GAME_SCHEDULER_INTERVAL = 30  # seconds between scheduler ticks

# Arbitrary unique integers used as PostgreSQL advisory lock keys.
# Only one app instance can hold each lock at a time, preventing
# duplicate market reveals or activations across concurrent dynos.
_LOCK_REVEAL   = 7001
_LOCK_ACTIVATE = 7002


async def _try_advisory_lock(db, lock_id: int) -> bool:
    """Return True if this instance acquired the transaction-level advisory lock."""
    result = await db.execute(text(f"SELECT pg_try_advisory_xact_lock({lock_id})"))
    return bool(result.scalar())


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


async def _game_scheduler_loop(shutdown: asyncio.Event) -> None:
    """
    Runs every GAME_SCHEDULER_INTERVAL seconds.
    - At minute 55: reveal stats or cancel markets with insufficient participants.
    - At minute 0-2: activate next question for each tier if not yet done this hour.
    - At AUTO_GENERATE_HOUR_UTC:00 — auto-generate 40 questions (10 per tier).

    Uses PostgreSQL advisory locks so only one instance acts per tick when
    multiple dynos are running.  Exits cleanly when `shutdown` is set.
    """
    from app.db.session import AsyncSessionLocal
    from app.core.game import reveal_or_cancel_open_markets, activate_all_tiers

    last_reveal_hour: int   = -1
    last_activate_hour: int = -1
    last_autogen_day: int   = -1

    while True:
        # Sleep for the interval, but wake immediately on shutdown signal.
        try:
            await asyncio.wait_for(shutdown.wait(), timeout=GAME_SCHEDULER_INTERVAL)
            logger.info("Game scheduler: shutdown signal received, exiting cleanly")
            break
        except asyncio.TimeoutError:
            pass

        now = datetime.now(timezone.utc)
        current_minute = now.minute
        current_hour   = now.hour
        current_day    = now.timetuple().tm_yday  # day-of-year

        try:
            # :55 mark — reveal or cancel quiz markets
            if current_minute >= 55 and last_reveal_hour != current_hour:
                # Mark attempted immediately; prevents this instance from
                # redundantly retrying if another instance holds the lock.
                last_reveal_hour = current_hour
                async with AsyncSessionLocal() as db:
                    if await _try_advisory_lock(db, _LOCK_REVEAL):
                        logger.info("Game scheduler: running reveal/cancel for hour %s", current_hour)
                        await reveal_or_cancel_open_markets(db)
                        await db.commit()
                    else:
                        logger.debug("Scheduler: reveal lock held by another instance, skipping")

            # :00 mark (minutes 0-2 to be safe with scheduler granularity)
            if current_minute <= 2 and last_activate_hour != current_hour:
                creator_id = await _get_system_creator_id()
                if creator_id:
                    last_activate_hour = current_hour
                    async with AsyncSessionLocal() as db:
                        if await _try_advisory_lock(db, _LOCK_ACTIVATE):
                            logger.info("Game scheduler: activating hourly questions for hour %s", current_hour)
                            await activate_all_tiers(db, creator_id)
                            await db.commit()
                        else:
                            logger.debug("Scheduler: activate lock held by another instance, skipping")

            # Daily auto-generation of 40 questions at AUTO_GENERATE_HOUR_UTC
            if current_hour == AUTO_GENERATE_HOUR_UTC and current_minute <= 2 and last_autogen_day != current_day:
                last_autogen_day = current_day
                logger.info("Game scheduler: running daily question auto-generation")
                from app.core.question_generate import generate_questions_scheduled
                result = await generate_questions_scheduled(target_per_tier=10)
                logger.info("Daily auto-generation result: %s", result)

        except Exception as exc:
            logger.error("Game scheduler error: %s", exc, exc_info=True)


async def _ensure_superuser() -> None:
    """Create the initial superuser from FIRST_SUPERUSER_* settings if not present."""
    from sqlalchemy import select
    from app.db.session import AsyncSessionLocal
    from app.models.user import User
    from app.core.security import get_password_hash
    import secrets

    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.email == settings.FIRST_SUPERUSER_EMAIL))
        if res.scalar_one_or_none():
            logger.info("Superuser '%s' already exists", settings.FIRST_SUPERUSER_EMAIL)
            return
        user = User(
            email=settings.FIRST_SUPERUSER_EMAIL,
            username=settings.FIRST_SUPERUSER_EMAIL.split("@")[0],
            hashed_password=get_password_hash(settings.FIRST_SUPERUSER_PASSWORD),
            full_name="Admin",
            referral_code=secrets.token_urlsafe(8)[:10],
            is_active=True,
            is_superuser=True,
        )
        db.add(user)
        await db.commit()
        logger.info("Created superuser '%s'", settings.FIRST_SUPERUSER_EMAIL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warn early if the server clock is not UTC; the game scheduler uses UTC
    # hour comparisons and will fire at the wrong local time otherwise.
    _now_local = datetime.now()
    _now_utc   = datetime.now(timezone.utc).replace(tzinfo=None)
    if abs((_now_local - _now_utc).total_seconds()) > 60:
        logger.warning(
            "Server clock does not appear to be in UTC (local=%s, utc=%s). "
            "AUTO_GENERATE_HOUR_UTC=%d may fire at the wrong time.",
            _now_local.strftime("%H:%M"),
            _now_utc.strftime("%H:%M"),
            AUTO_GENERATE_HOUR_UTC,
        )

    await _ensure_superuser()

    shutdown_event = asyncio.Event()
    scheduler_task = asyncio.create_task(_game_scheduler_loop(shutdown_event))
    logger.info("Game scheduler started (interval=%ds)", GAME_SCHEDULER_INTERVAL)

    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning(
            "TELEGRAM_BOT_TOKEN is not set — Telegram bot, webhook endpoint, "
            "and all in-app push notifications are disabled. "
            "Set TELEGRAM_BOT_TOKEN in environment variables to enable them."
        )
    else:
        from app.bot.application import get_application
        bot_app = get_application()
        await bot_app.initialize()
        logger.info("Telegram bot initialized")

    yield

    # Signal scheduler to stop and give it time to finish any in-flight DB work.
    shutdown_event.set()
    try:
        await asyncio.wait_for(scheduler_task, timeout=10.0)
    except asyncio.TimeoutError:
        logger.warning("Scheduler did not finish within 10 s; cancelling")
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
