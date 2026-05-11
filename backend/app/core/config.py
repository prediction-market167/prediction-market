from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "PredictionMarket"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_database_url(cls, v: str) -> str:
        if not isinstance(v, str):
            return v
        # Rewrite scheme for asyncpg dialect
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        elif v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        # Railway public proxy requires SSL; skip for local/CI and internal Railway connections
        if "localhost" not in v and "127.0.0.1" not in v and "railway.internal" not in v and "ssl=" not in v:
            v += ("&" if "?" in v else "?") + "ssl=require"
        return v

    REDIS_URL: str = "redis://localhost:6379/0"

    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "https://prediction-market-nine-blond.vercel.app",
        "https://prediction-market-pphj.onrender.com",
    ]

    DEPOSIT_TON_ADDRESS: str | None = None
    MASTER_ADMIN_WALLET: str | None = None

    TELEGRAM_BOT_TOKEN: str | None = None
    TELEGRAM_BOT_USERNAME: str | None = None
    MINI_APP_URL: str = "https://prediction-market-nine-blond.vercel.app"
    WEBHOOK_URL: str | None = None
    TELEGRAM_WEBHOOK_SECRET: str | None = None

    FIRST_SUPERUSER_EMAIL: str = "admin@predictionmarket.mn"
    FIRST_SUPERUSER_PASSWORD: str

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
