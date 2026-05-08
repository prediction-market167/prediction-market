import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.token import Token
from app.schemas.user import UserCreate, UserResponse, TelegramAuthRequest
from app.core.security import verify_password, get_password_hash, create_access_token, verify_telegram_init_data

router = APIRouter()


def _make_referral_code() -> str:
    return secrets.token_urlsafe(8)[:10]


async def _resolve_referrer(ref_code: str | None, db: AsyncSession) -> int | None:
    if not ref_code:
        return None
    res = await db.execute(select(User).where(User.referral_code == ref_code))
    referrer = res.scalar_one_or_none()
    return referrer.id if referrer else None


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    ref: str | None = Query(None, description="Referral code of the inviter"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    referred_by_id = await _resolve_referrer(ref, db)

    user = User(
        email=user_in.email,
        username=user_in.username,
        full_name=user_in.full_name,
        hashed_password=get_password_hash(user_in.password),
        referral_code=_make_referral_code(),
        referred_by_id=referred_by_id,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    return Token(access_token=create_access_token(user.id))


@router.post("/telegram", response_model=Token)
async def telegram_auth(
    body: TelegramAuthRequest,
    ref: str | None = Query(None, description="Referral code of the inviter"),
    db: AsyncSession = Depends(get_db),
):
    if not settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Telegram auth not configured")

    tg_user = verify_telegram_init_data(body.init_data, settings.TELEGRAM_BOT_TOKEN)
    if not tg_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram auth data")

    telegram_id = tg_user.get("id")
    if not telegram_id:
        raise HTTPException(status_code=400, detail="Missing Telegram user ID")

    result = await db.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()

    if not user:
        username = tg_user.get("username") or f"tg_{telegram_id}"
        existing = await db.execute(select(User).where(User.username == username))
        if existing.scalar_one_or_none():
            username = f"tg_{telegram_id}"

        first = tg_user.get("first_name", "")
        last = tg_user.get("last_name", "")

        referred_by_id = await _resolve_referrer(ref, db)

        user = User(
            telegram_id=telegram_id,
            email=f"telegram_{telegram_id}@telegram.local",
            username=username,
            hashed_password=get_password_hash(secrets.token_urlsafe(32)),
            full_name=f"{first} {last}".strip() or None,
            referral_code=_make_referral_code(),
            referred_by_id=referred_by_id,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
    else:
        # Ensure existing users get a referral_code if they don't have one
        if not user.referral_code:
            user.referral_code = _make_referral_code()

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    return Token(access_token=create_access_token(user.id))
