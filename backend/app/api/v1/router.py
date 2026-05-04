from fastapi import APIRouter
from app.api.v1.endpoints import auth, bets, markets, telegram, users

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(markets.router, prefix="/markets", tags=["markets"])
api_router.include_router(bets.router, prefix="/bets", tags=["bets"])
api_router.include_router(telegram.router, prefix="/telegram", tags=["telegram"])
