from datetime import datetime, timedelta, timezone
from typing import Any
import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl
import bcrypt
from jose import jwt
from app.core.config import settings


def create_access_token(subject: Any, expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return jwt.encode(
        {"exp": expire, "sub": str(subject)},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_telegram_init_data(init_data: str, bot_token: str, max_age_seconds: int = 86400) -> dict | None:
    """Validate Telegram WebApp initData HMAC and return the user dict, or None if invalid."""
    params = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = params.pop("hash", None)
    if not received_hash:
        return None

    auth_date = int(params.get("auth_date", 0))
    if time.time() - auth_date > max_age_seconds:
        return None

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        return None

    try:
        return json.loads(params.get("user", "{}"))
    except json.JSONDecodeError:
        return None
