from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.models.jackpot import SystemFunds
from app.models.withdrawal import Withdrawal
from app.models.transaction import Transaction, TransactionType
from app.schemas.user import UserResponse, UserUpdate

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
):
    for field, value in user_in.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    return current_user


@router.get("/me/deposit-address")
async def get_deposit_address(current_user: User = Depends(get_current_user)):
    if not settings.DEPOSIT_TON_ADDRESS:
        raise HTTPException(status_code=503, detail="TON deposits not configured")
    return {
        "address": settings.DEPOSIT_TON_ADDRESS,
        "memo": str(current_user.id),
        "amount_per_credit": "1",
    }


@router.get("/me/platform-settings")
async def get_platform_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemFunds).where(SystemFunds.id == 1))
    funds = result.scalar_one_or_none()
    return {
        "stars_to_ton_rate": float(funds.stars_to_ton_rate) if funds else 100.0,
    }


class WithdrawRequest(BaseModel):
    amount_stars: int


@router.post("/me/withdraw")
async def withdraw(
    body: WithdrawRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.MASTER_ADMIN_WALLET:
        raise HTTPException(status_code=503, detail="Withdrawals are currently disabled")
    if current_user.is_blocked:
        raise HTTPException(status_code=403, detail="account_blocked")
    if not current_user.ton_wallet_address:
        raise HTTPException(status_code=400, detail="No TON wallet connected")
    if body.amount_stars <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    if current_user.balance < Decimal(body.amount_stars):
        raise HTTPException(status_code=400, detail="Insufficient balance")

    funds_res = await db.execute(select(SystemFunds).where(SystemFunds.id == 1))
    funds = funds_res.scalar_one_or_none()
    rate = funds.stars_to_ton_rate if funds else Decimal("100")

    amount_ton = Decimal(body.amount_stars) / rate

    balance_before = current_user.balance
    current_user.balance -= Decimal(body.amount_stars)

    withdrawal = Withdrawal(
        user_id=current_user.id,
        amount_stars=Decimal(body.amount_stars),
        amount_ton=amount_ton,
        wallet_address=current_user.ton_wallet_address,
        status="pending",
    )
    db.add(withdrawal)

    tx = Transaction(
        user_id=current_user.id,
        type=TransactionType.WITHDRAWAL,
        amount=-Decimal(body.amount_stars),
        balance_before=balance_before,
        balance_after=current_user.balance,
        description=f"Withdrawal: {body.amount_stars} ⭐ → {float(amount_ton):.4f} TON",
    )
    db.add(tx)
    await db.flush()

    return {
        "withdrawal_id": withdrawal.id,
        "amount_stars": body.amount_stars,
        "amount_ton": float(amount_ton),
        "wallet_address": current_user.ton_wallet_address,
        "status": "pending",
    }
