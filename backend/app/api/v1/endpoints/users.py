from fastapi import APIRouter, Depends, HTTPException
from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.models.user import User
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
