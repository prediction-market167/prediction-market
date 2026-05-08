"""In-memory rate limiter for bot detection.

Two rules:
  1. Minimum 2 seconds between consecutive bet submissions per user.
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

# Per user_id: timestamps of recent bet submissions
_request_log: dict[int, deque] = defaultdict(deque)
# Per user_id: timestamp of last bet
_last_bet: dict[int, float] = {}


async def check_bet_rate_limit(user_id: int, db: AsyncSession) -> None:
    """Raise 429 if user is submitting too fast. Auto-block on sustained abuse."""
    now = time.monotonic()

    # Rule 1: minimum interval between submissions
    last = _last_bet.get(user_id)
    if last is not None and (now - last) < _MIN_INTERVAL_SECONDS:
        raise HTTPException(status_code=429, detail="too_fast")

    # Sliding window cleanup
    log = _request_log[user_id]
    while log and (now - log[0]) > _WINDOW_SECONDS:
        log.popleft()

    log.append(now)
    _last_bet[user_id] = now

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
        logger.warning("Auto-blocked user %s for rapid submission", user_id)
