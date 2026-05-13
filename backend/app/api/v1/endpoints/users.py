import re
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

# Accepts TON user-friendly addresses (48 base64url chars, e.g. EQD... / UQD...)
# and raw addresses (workchain_id:64_hex_chars, e.g. 0:abcdef...).
_TON_ADDRESS_RE = re.compile(
    r'^(?:[0-9A-Za-z_-]{48}|-?[0-9]:[0-9a-fA-F]{64})$'
)


def _validate_ton_address(address: str) -> str:
    """Strip, validate and return a TON wallet address; raise 400 if invalid."""
    addr = address.strip()
    if not addr:
        raise HTTPException(status_code=400, detail="Wallet address is required")
    if not _TON_ADDRESS_RE.match(addr):
        raise HTTPException(
            status_code=400,
            detail="Invalid TON wallet address. Expected a 48-character user-friendly address (e.g. EQD...) or raw format (0:hex64).",
        )
    return addr


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
):
    data = user_in.model_dump(exclude_unset=True)
    if "ton_wallet_address" in data and data["ton_wallet_address"] is not None:
        data["ton_wallet_address"] = _validate_ton_address(data["ton_wallet_address"])
    for field, value in data.items():
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


MIN_WITHDRAWAL_GEMS = 1000


class WithdrawRequest(BaseModel):
    amount_gems: int
    wallet_address: str


@router.post("/me/withdraw")
async def withdraw(
    body: WithdrawRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.is_blocked:
        raise HTTPException(status_code=403, detail="account_blocked")
    if body.amount_gems < MIN_WITHDRAWAL_GEMS:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum withdrawal is {MIN_WITHDRAWAL_GEMS} Gems",
        )
    wallet = _validate_ton_address(body.wallet_address)
    if current_user.airdrop_claimed and not current_user.has_paid_entry:
        raise HTTPException(
            status_code=400,
            detail="paid_entry_required",
        )
    if current_user.balance < Decimal(body.amount_gems):
        raise HTTPException(status_code=400, detail="Insufficient balance (bonus credits cannot be withdrawn)")

    # Check no pending withdrawal already exists
    pending_res = await db.execute(
        select(Withdrawal).where(
            Withdrawal.user_id == current_user.id,
            Withdrawal.status == "pending",
        )
    )
    if pending_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have a pending withdrawal")

    funds_res = await db.execute(select(SystemFunds).where(SystemFunds.id == 1))
    funds = funds_res.scalar_one_or_none()
    rate = funds.stars_to_ton_rate if funds else Decimal("100")

    amount_ton = Decimal(body.amount_gems) / rate

    balance_before = current_user.balance
    current_user.balance -= Decimal(body.amount_gems)

    withdrawal = Withdrawal(
        user_id=current_user.id,
        amount_stars=Decimal(body.amount_gems),
        amount_ton=amount_ton,
        wallet_address=wallet,
        status="pending",
    )
    db.add(withdrawal)

    tx = Transaction(
        user_id=current_user.id,
        type=TransactionType.WITHDRAWAL,
        amount=-Decimal(body.amount_gems),
        balance_before=balance_before,
        balance_after=current_user.balance,
        description=f"Withdrawal request: {body.amount_gems} Gems → {float(amount_ton):.4f} TON",
    )
    db.add(tx)
    await db.flush()

    return {
        "withdrawal_id": withdrawal.id,
        "amount_gems": body.amount_gems,
        "amount_ton": float(amount_ton),
        "wallet_address": wallet,
        "status": "pending",
    }


@router.get("/me/withdrawals")
async def get_my_withdrawals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Withdrawal)
        .where(Withdrawal.user_id == current_user.id)
        .order_by(Withdrawal.created_at.desc())
        .limit(20)
    )
    withdrawals = result.scalars().all()
    return [
        {
            "id": w.id,
            "amount_gems": float(w.amount_stars),
            "amount_ton": float(w.amount_ton),
            "wallet_address": w.wallet_address,
            "status": w.status,
            "tx_hash": w.tx_hash,
            "note": w.note,
            "created_at": w.created_at.isoformat() if w.created_at else None,
        }
        for w in withdrawals
    ]
