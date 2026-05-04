from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl
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

    REDIS_URL: str = "redis://localhost:6379/0"

    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]

    DEPOSIT_TON_ADDRESS: str | None = None

    TELEGRAM_BOT_TOKEN: str | None = None
    TELEGRAM_BOT_USERNAME: str | None = None
    MINI_APP_URL: str = "https://prediction-market.app"
    WEBHOOK_URL: str | None = None
    TELEGRAM_WEBHOOK_SECRET: str | None = None

    FIRST_SUPERUSER_EMAIL: str = "admin@predictionmarket.mn"
    FIRST_SUPERUSER_PASSWORD: str = "changeme123"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
