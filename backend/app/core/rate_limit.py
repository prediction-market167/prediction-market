"""In-memory rate limiter for bot detection.

Tracking key is Telegram ID (falls back to internal user ID for non-Telegram users).

Two rules:
  1. Minimum 2 seconds between consecutive bet submissions per key.
  2. 5+ requests within any 10-second window → auto-block the user in DB.
"""
import logging
import time
from collections import defaultdict, deque
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

logger = logging.getLogger(__name__)

_WINDOW_SECONDS = 10.0
_MAX_IN_WINDOW = 5
_MIN_INTERVAL_SECONDS = 2.0

# Keyed by Telegram ID (int) or "u{user_id}" string for non-Telegram users
_request_log: dict[str, deque] = defaultdict(deque)
_last_bet: dict[str, float] = {}


def _key(telegram_id: int | None, user_id: int) -> str:
    return str(telegram_id) if telegram_id is not None else f"u{user_id}"


async def check_bet_rate_limit(telegram_id: int | None, user_id: int, db: AsyncSession) -> None:
    """Raise 429 if user is submitting too fast. Auto-block on sustained abuse."""
    k = _key(telegram_id, user_id)
    now = time.monotonic()

    # Rule 1: minimum interval between submissions
    last = _last_bet.get(k)
    if last is not None and (now - last) < _MIN_INTERVAL_SECONDS:
        raise HTTPException(status_code=429, detail="too_fast")

    # Sliding window cleanup
    log = _request_log[k]
    while log and (now - log[0]) > _WINDOW_SECONDS:
        log.popleft()

    log.append(now)
    _last_bet[k] = now

    # Rule 2: sustained high rate → auto-block
    if len(log) >= _MAX_IN_WINDOW:
        await _auto_block(user_id, db)
        raise HTTPException(status_code=429, detail="bot_blocked")


async def _auto_block(user_id: int, db: AsyncSession) -> None:
    from app.models.user import User
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user and not user.is_blocked:
        user.is_blocked = True
        user.blocked_at = datetime.now(timezone.utc)
        user.block_reason = "Auto-blocked: 5+ requests in 10 seconds"
        await db.flush()
        logger.warning(
            "Auto-blocked user %s (telegram_id=%s) for rapid submission",
            user_id, user.telegram_id,
        )
