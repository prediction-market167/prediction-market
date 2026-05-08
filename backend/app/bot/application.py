import logging
from decimal import Decimal

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo
from telegram.ext import (
    Application, CommandHandler, ContextTypes,
    MessageHandler, PreCheckoutQueryHandler, filters,
)

from app.core.config import settings

logger = logging.getLogger(__name__)
_application: Application | None = None


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    keyboard = [[InlineKeyboardButton("Open Quiz Star ⚡", web_app=WebAppInfo(url=settings.MINI_APP_URL))]]
    await update.message.reply_text(
        "⚡ Welcome to Quiz Star!\nAnswer fast, win big!",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def app_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    keyboard = [[InlineKeyboardButton("Open Quiz Star ⚡", web_app=WebAppInfo(url=settings.MINI_APP_URL))]]
    await update.message.reply_text("Tap to open:", reply_markup=InlineKeyboardMarkup(keyboard))


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "Available commands:\n"
        "/start — Welcome message\n"
        "/app — Open Quiz Star\n"
        "/help — Show this help"
    )


async def pre_checkout_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.pre_checkout_query.answer(ok=True)


async def successful_payment_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    payment = update.message.successful_payment
    payload = payment.invoice_payload
    telegram_charge_id = payment.telegram_payment_charge_id

    from app.db.session import AsyncSessionLocal
    from app.models.star_payment import StarPayment, StarPaymentStatus
    from app.models.market import Market, MarketStatus
    from app.models.user import User
    from app.models.bet import Bet, BetSide
    from app.models.transaction import Transaction, TransactionType
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(StarPayment).where(StarPayment.payload == payload))
        star_payment = result.scalar_one_or_none()
        if not star_payment or star_payment.status != StarPaymentStatus.PENDING:
            logger.warning("Stars payment: payload %s not found or already processed", payload)
            return

        market_res = await db.execute(select(Market).where(Market.id == star_payment.market_id))
        market = market_res.scalar_one_or_none()
        user_res = await db.execute(select(User).where(User.id == star_payment.user_id))
        user = user_res.scalar_one_or_none()

        if not market or not user:
            star_payment.status = StarPaymentStatus.FAILED
            await db.commit()
            return

        if market.status != MarketStatus.OPEN:
            star_payment.status = StarPaymentStatus.FAILED
            await db.commit()
            logger.warning("Stars payment: market #%s is no longer open", market.id)
            return

        bet_amount = star_payment.bet_amount
        prob = market.yes_probability if star_payment.side == BetSide.YES else market.no_probability
        potential_payout = bet_amount / prob

        # Credit Stars as deposit, then place bet — keeps balance accounting clean
        balance_before = user.balance
        user.balance += Decimal(star_payment.stars_amount)
        market.total_volume += bet_amount

        bet = Bet(
            user_id=user.id,
            market_id=market.id,
            side=star_payment.side,
            amount=bet_amount,
            probability_at_bet=prob,
            potential_payout=potential_payout,
        )
        db.add(bet)

        deposit_tx = Transaction(
            user_id=user.id,
            type=TransactionType.DEPOSIT,
            amount=Decimal(star_payment.stars_amount),
            balance_before=balance_before,
            balance_after=user.balance,
            description=f"Telegram Stars deposit ({star_payment.stars_amount} ⭐)",
        )
        db.add(deposit_tx)

        bet_tx = Transaction(
            user_id=user.id,
            type=TransactionType.BET_PLACED,
            amount=-bet_amount,
            balance_before=user.balance,
            balance_after=user.balance - bet_amount,
            description=f"Stars bet on market #{market.id} — {star_payment.side.value.upper()}",
        )
        user.balance -= bet_amount
        db.add(bet_tx)

        await db.flush()
        await db.refresh(bet)

        star_payment.status = StarPaymentStatus.PAID
        star_payment.telegram_charge_id = telegram_charge_id
        star_payment.bet_id = bet.id

        await db.commit()
        logger.info("Stars payment processed: payment_id=%s bet_id=%s", star_payment.id, bet.id)


def get_application() -> Application:
    global _application
    if _application is None:
        if not settings.TELEGRAM_BOT_TOKEN:
            raise RuntimeError("TELEGRAM_BOT_TOKEN is not configured")
        _application = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).build()
        _application.add_handler(CommandHandler("start", start_command))
        _application.add_handler(CommandHandler("app", app_command))
        _application.add_handler(CommandHandler("help", help_command))
        _application.add_handler(PreCheckoutQueryHandler(pre_checkout_handler))
        _application.add_handler(MessageHandler(filters.SUCCESSFUL_PAYMENT, successful_payment_handler))
    return _application
