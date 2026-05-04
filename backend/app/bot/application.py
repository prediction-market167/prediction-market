from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo
from telegram.ext import Application, CommandHandler, ContextTypes

from app.core.config import settings

_application: Application | None = None


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    keyboard = [[InlineKeyboardButton("Open Prediction Market", web_app=WebAppInfo(url=settings.MINI_APP_URL))]]
    await update.message.reply_text(
        "Welcome to Prediction Market!\nPredict real-world outcomes and earn rewards.",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def app_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    keyboard = [[InlineKeyboardButton("Open App", web_app=WebAppInfo(url=settings.MINI_APP_URL))]]
    await update.message.reply_text("Tap to open:", reply_markup=InlineKeyboardMarkup(keyboard))


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "Available commands:\n"
        "/start — Welcome message\n"
        "/app — Open the Prediction Market app\n"
        "/help — Show this help"
    )


def get_application() -> Application:
    global _application
    if _application is None:
        if not settings.TELEGRAM_BOT_TOKEN:
            raise RuntimeError("TELEGRAM_BOT_TOKEN is not configured")
        _application = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).build()
        _application.add_handler(CommandHandler("start", start_command))
        _application.add_handler(CommandHandler("app", app_command))
        _application.add_handler(CommandHandler("help", help_command))
    return _application
