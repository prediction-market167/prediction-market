from pydantic import BaseModel, ConfigDict, EmailStr, field_serializer
from decimal import Decimal
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: str | None = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str | None = None
    email: EmailStr | None = None
    ton_wallet_address: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserAdminUpdate(BaseModel):
    is_active: bool | None = None
    is_superuser: bool | None = None
    balance: Decimal | None = None


class UserResponse(UserBase):
    id: int
    email: str  # override EmailStr — Telegram users get a synthetic non-standard address
    balance: Decimal
    is_active: bool
    is_superuser: bool
    ton_wallet_address: str | None = None
    referral_code: str | None = None
    lifetime_referral_earnings: Decimal = Decimal("0")
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("balance", "lifetime_referral_earnings")
    def serialize_decimal(self, value: Decimal) -> str:
        return str(value)


class TelegramAuthRequest(BaseModel):
    init_data: str
