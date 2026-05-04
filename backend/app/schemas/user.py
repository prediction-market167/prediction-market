from pydantic import BaseModel, EmailStr
from decimal import Decimal
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: str | None = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    ton_wallet_address: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: int
    email: str  # override EmailStr — Telegram users get a synthetic non-standard address
    balance: Decimal
    is_active: bool
    ton_wallet_address: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TelegramAuthRequest(BaseModel):
    init_data: str
