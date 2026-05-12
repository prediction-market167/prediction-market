import asyncio
import logging
from decimal import Decimal

from telegram import (
    InlineKeyboardButton, InlineKeyboardMarkup,
    KeyboardButton, ReplyKeyboardMarkup,
    Update, WebAppInfo,
)
from telegram.ext import (
    Application, CommandHandler, ContextTypes,
    MessageHandler, PreCheckoutQueryHandler, filters,
)

from app.core.config import settings

logger = logging.getLogger(__name__)
_application: Application | None = None

_OPEN_BTN = lambda: [[InlineKeyboardButton("Open Quiz Star ⚡", web_app=WebAppInfo(url=settings.MINI_APP_URL))]]

SUPPORT_URL = "https://t.me/Quizstarcommunity"


def _main_keyboard() -> ReplyKeyboardMarkup:
    support_url = f"{settings.MINI_APP_URL.rstrip('/')}/support"
    return ReplyKeyboardMarkup(
        [[KeyboardButton("Support 💬", web_app=WebAppInfo(url=support_url))]],
        resize_keyboard=False,
        is_persistent=True,
    )


async def _bot_send(chat_id: int, text: str, **kwargs) -> None:
    """Send a Telegram message, retrying up to 3 times on transient failure."""
    bot = get_application().bot
    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            await bot.send_message(chat_id=chat_id, text=text, **kwargs)
            return
        except Exception as exc:
            last_exc = exc
            if attempt < 2:
                await asyncio.sleep(2 ** attempt)  # 1 s then 2 s
    logger.warning("Telegram send failed after 3 attempts chat_id=%s: %s", chat_id, last_exc)


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "⚡ Welcome to Quiz Star!\nAnswer fast, win big!",
        reply_markup=_main_keyboard(),
    )


async def support_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        f"💬 Join our community:\n{SUPPORT_URL}",
        reply_markup=_main_keyboard(),
    )


async def app_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "Tap to open Quiz Star ⚡",
        reply_markup=InlineKeyboardMarkup(_OPEN_BTN()),
    )


async def profile_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    from sqlalchemy import select, func
    from app.db.session import AsyncSessionLocal
    from app.models.user import User
    from app.models.bet import Bet, BetStatus

    tg_id = update.effective_user.id
    async with AsyncSessionLocal() as db:
        user_res = await db.execute(select(User).where(User.telegram_id == tg_id))
        user = user_res.scalar_one_or_none()

    if not user:
        await update.message.reply_text(
            "You don't have a Quiz Star account yet.\nOpen the app to get started! ⚡",
            reply_markup=InlineKeyboardMarkup(_OPEN_BTN()),
        )
        return

    async with AsyncSessionLocal() as db:
        total_res = await db.execute(
            select(func.count(Bet.id)).where(
                Bet.user_id == user.id,
                Bet.status != BetStatus.CANCELLED,
            )
        )
        total = total_res.scalar_one() or 0

        won_res = await db.execute(
            select(func.count(Bet.id)).where(
                Bet.user_id == user.id,
                Bet.status == BetStatus.WON,
            )
        )
        won = won_res.scalar_one() or 0

        ref_res = await db.execute(
            select(func.count(User.id)).where(User.referred_by_id == user.id)
        )
        ref_count = ref_res.scalar_one() or 0

    win_rate = f"{won / total * 100:.0f}%" if total > 0 else "—"

    text = (
        f"👤 *{user.username}*\n\n"
        f"⭐ Balance: *{int(user.balance):,} Stars*\n"
        f"🎯 Contests Entered: *{total}*\n"
        f"🏆 Win Rate: *{win_rate}*\n"
        f"👥 Referrals: *{ref_count}*"
    )
    await update.message.reply_text(
        text,
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(_OPEN_BTN()),
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "🎮 *How to Play Quiz Star*\n\n"
        "Every hour a new quiz question goes live\\. Answer correctly *and fast* — "
        "the quicker you answer, the higher you rank\\!\n\n"
        "📊 *Contest Tiers:*\n"
        "🟢 *Free* — Practice mode, no Stars needed\n"
        "🔵 *Easy* — Low entry, great for beginners\n"
        "🟡 *Medium* — Higher prizes, tougher questions\n"
        "🔴 *Hard* — Maximum prizes, expert level\n\n"
        "🏆 *Prize Distribution:*\n"
        "Top 5 fastest correct answers split 70% of the pool:\n"
        "1st → 40% · 2nd → 25% · 3rd → 15% · 4th → 10% · 5th → 10%\n"
        "10% feeds the Jackpot · 10% Referral bonus\n\n"
        "📱 *Commands:*\n"
        "/profile — Your stats\n"
        "/referral — Your referral link\n"
        "/help — This message"
    )
    await update.message.reply_text(
        text,
        parse_mode="MarkdownV2",
        reply_markup=InlineKeyboardMarkup(_OPEN_BTN()),
    )


async def referral_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    tg_id = update.effective_user.id
    bot_username = settings.TELEGRAM_BOT_USERNAME or "predictmarketa_bot"
    ref_link = f"https://t.me/{bot_username}?start=ref_{tg_id}"

    text = (
        f"👥 *Your Referral Link*\n\n"
        f"`{ref_link}`\n\n"
        f"Share this link and earn *10% of every paid entry* your friends make — forever\\!\n\n"
        f"🎁 *Milestone Rewards:*\n"
        f"• 3 active friends → Free Easy ticket 🎫\n"
        f"• 5 active friends → Free Medium ticket 🎫\n"
        f"• 10 active friends → Free Hard ticket 🎫"
    )
    await update.message.reply_text(text, parse_mode="MarkdownV2")


async def terms_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "📋 *Terms of Service*\n\n"
        "Read the full Quiz Star Terms of Service here:\n"
        "https://prediction\\-market\\-nine\\-blond\\.vercel\\.app/terms"
    )
    await update.message.reply_text(
        text,
        parse_mode="MarkdownV2",
        reply_markup=InlineKeyboardMarkup(_OPEN_BTN()),
    )


def _t(lang: str | None) -> dict:
    """Localized notification strings."""
    if lang == 'mn':
        return dict(
            cancel="⏰ Тэмцээн цуцлагдлаа!\n\nОролцогчдын тоо хүрэлцэхгүй байсан тул тэмцээн цуцлагдлаа.\n💎 {amount} Gems таны дансанд буцааллаа.\n\n⚡ Дахин оролцох уу?",
            loss="😔 Энэ удаа болсонгүй!\n\nДараагийн тэмцээнд оролцоод ялаарай!",
            loss_btn="⚡ Одоо тоглох",
            payment="✅ Дансаа амжилттай цэнэглэлээ!\n\n💎 {amount} Gems таны дансанд орлоо.\nОдоо тэмцээнд оролцоорой!",
            bet="⚡ Хариулт амжилттай илгээгдлээ!\n\n⏰ Үр дүн :55дахь минутад гарна. Амжилт хүсье! 🍀",
            winner="{emoji} Та {rank}-р байр эзэллээ!\n\nТа quiz #{market_id}-аас {prize} 💎 хожлоо!\nТаны данс шинэчлэгдлээ.",
        )
    elif lang == 'ru':
        return dict(
            cancel="⏰ Конкурс отменён!\n\nНедостаточно участников — конкурс отменён.\n💎 {amount} Gems возвращены на ваш баланс.\n\n⚡ Попробуйте снова?",
            loss="😔 В этот раз не повезло!\n\nУчаствуйте в следующем конкурсе и побеждайте!",
            loss_btn="⚡ Играть сейчас",
            payment="✅ Баланс успешно пополнен!\n\n💎 {amount} Gems зачислены.\nУчаствуйте в конкурсе прямо сейчас!",
            bet="⚡ Ответ успешно отправлен!\n\n⏰ Результаты появятся в :55. Удачи! 🍀",
            winner="{emoji} Вы заняли {rank}-е место!\n\nВы выиграли {prize} 💎 в quiz #{market_id}!\nБаланс обновлён.",
        )
    elif lang == 'hi':
        return dict(
            cancel="⏰ प्रतियोगिता रद्द हुई!\n\nपर्याप्त प्रतिभागी नहीं थे, इसलिए प्रतियोगिता रद्द हुई।\n💎 {amount} Gems वापस आ गए।\n\n⚡ फिर से खेलें?",
            loss="😔 इस बार नहीं हुआ!\n\nअगली प्रतियोगिता में हिस्सा लें और जीतें!",
            loss_btn="⚡ अभी खेलें",
            payment="✅ बैलेंस सफलतापूर्वक जमा हुआ!\n\n💎 {amount} Gems आ गए।\nअभी प्रतियोगिता में हिस्सा लें!",
            bet="⚡ उत्तर सफलतापूर्वक भेजा गया!\n\n⏰ परिणाम :55 पर आएंगे। शुभकामनाएं! 🍀",
            winner="{emoji} आपने {rank}वां स्थान प्राप्त किया!\n\nआपने quiz #{market_id} से {prize} 💎 जीते!\nबैलेंस अपडेट हो गया।",
        )
    else:  # 'en' or unknown
        return dict(
            cancel="⏰ Contest cancelled!\n\nNot enough players joined, so the contest was cancelled.\n💎 {amount} Gems have been refunded to your balance.\n\n⚡ Want to play again?",
            loss="😔 Not this time!\n\nJoin the next contest and win!",
            loss_btn="⚡ Play now",
            payment="✅ Balance topped up!\n\n💎 {amount} Gems added to your balance.\nJoin a contest now!",
            bet="⚡ Answer submitted!\n\n⏰ Results appear at :55. Good luck! 🍀",
            winner="{emoji} You placed #{rank}!\n\nYou won {prize} 💎 from quiz #{market_id}!\nYour balance has been updated.",
        )


async def send_winner_notification(telegram_id: int, rank: int, prize: int, market_id: int, lang: str | None = None) -> None:
    rank_emojis = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"]
    emoji = rank_emojis[rank - 1] if 1 <= rank <= 5 else "🏅"
    text = _t(lang)['winner'].format(emoji=emoji, rank=rank, prize=f"{prize:,}", market_id=market_id)
    await _bot_send(
        telegram_id, text,
        reply_markup=InlineKeyboardMarkup(_OPEN_BTN()),
    )


async def send_refund_notification(telegram_id: int, amount: int, market_id: int, lang: str | None = None) -> None:
    text = _t(lang)['cancel'].format(amount=amount)
    await _bot_send(
        telegram_id, text,
        reply_markup=InlineKeyboardMarkup(_OPEN_BTN()),
    )


async def send_loss_notification(telegram_id: int, lang: str | None = None) -> None:
    strings = _t(lang)
    await _bot_send(
        telegram_id,
        strings['loss'],
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton(strings['loss_btn'], web_app=WebAppInfo(url=settings.MINI_APP_URL))
        ]]),
    )


async def send_payment_success_notification(telegram_id: int, amount: int, lang: str | None = None) -> None:
    text = _t(lang)['payment'].format(amount=amount)
    await _bot_send(
        telegram_id, text,
        reply_markup=InlineKeyboardMarkup(_OPEN_BTN()),
    )


async def send_bet_submitted_notification(telegram_id: int, lang: str | None = None) -> None:
    await _bot_send(telegram_id, _t(lang)['bet'])


async def send_withdrawal_approved_notification(
    telegram_id: int, ton_amount: float, tx_hash: str
) -> None:
    ton_str = f"{ton_amount:.4f}".rstrip("0").rstrip(".")
    text = (
        f"✅ *Withdrawal Approved*\n\n"
        f"Your withdrawal of *{ton_str} TON* has been sent to your wallet\\.\n\n"
        f"`{tx_hash[:16]}…`"
    )
    await _bot_send(
        telegram_id, text,
        parse_mode="MarkdownV2",
        reply_markup=InlineKeyboardMarkup(_OPEN_BTN()),
    )


async def send_withdrawal_rejected_notification(
    telegram_id: int, gems_amount: float
) -> None:
    gems_str = int(gems_amount)
    text = (
        f"❌ *Withdrawal Rejected*\n\n"
        f"Your withdrawal request was rejected\\. "
        f"*{gems_str} 💎 Gems* have been refunded to your balance\\."
    )
    await _bot_send(
        telegram_id, text,
        parse_mode="MarkdownV2",
        reply_markup=InlineKeyboardMarkup(_OPEN_BTN()),
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
        potential_payout = bet_amount / prob if prob else Decimal("0")

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

        # Credit SystemFunds ledgers — same split as balance-funded bets
        # 70% prize · 10% jackpot · 10% referral (if referrer) · 10% platform
        if bet_amount > 0:
            from app.models.jackpot import SystemFunds
            funds_res = await db.execute(select(SystemFunds).where(SystemFunds.id == 1))
            funds = funds_res.scalar_one_or_none()
            has_referrer = bool(user.referred_by_id)
            if funds:
                funds.prize_pool_balance += bet_amount * Decimal("0.70")
                funds.jackpot_balance += bet_amount * Decimal("0.10")
                if has_referrer:
                    funds.referral_pool_balance += bet_amount * Decimal("0.10")
                    funds.admin_profit_balance += bet_amount * Decimal("0.10")
                else:
                    funds.admin_profit_balance += bet_amount * Decimal("0.20")
                funds.total_revenue += bet_amount
            else:
                db.add(SystemFunds(
                    id=1,
                    prize_pool_balance=bet_amount * Decimal("0.70"),
                    jackpot_balance=bet_amount * Decimal("0.10"),
                    referral_pool_balance=bet_amount * Decimal("0.10") if has_referrer else Decimal("0"),
                    admin_profit_balance=bet_amount * Decimal("0.10") if has_referrer else bet_amount * Decimal("0.20"),
                    total_revenue=bet_amount,
                ))

        await db.flush()
        await db.refresh(bet)

        star_payment.status = StarPaymentStatus.PAID
        star_payment.telegram_charge_id = telegram_charge_id
        star_payment.bet_id = bet.id

        await db.commit()

        # Referral bonus — must run after commit so the bet record exists
        if bet_amount > 0:
            from app.api.v1.endpoints.bets import _handle_referral_bonus
            async with AsyncSessionLocal() as ref_db:
                mkt_res = await ref_db.execute(select(Market).where(Market.id == market.id))
                mkt = mkt_res.scalar_one_or_none()
                usr_res = await ref_db.execute(select(User).where(User.id == user.id))
                usr = usr_res.scalar_one_or_none()
                if mkt and usr:
                    await _handle_referral_bonus(mkt, usr, bet_amount, ref_db)
                    await ref_db.commit()

        logger.info("Stars payment processed: payment_id=%s bet_id=%s", star_payment.id, bet.id)

        # Notify user of successful payment
        if user.telegram_id:
            try:
                await send_payment_success_notification(
                    user.telegram_id, int(star_payment.stars_amount),
                    lang=user.language_code,
                )
            except Exception as exc:
                logger.warning("Payment success notification failed: %s", exc)


def get_application() -> Application:
    global _application
    if _application is None:
        if not settings.TELEGRAM_BOT_TOKEN:
            raise RuntimeError("TELEGRAM_BOT_TOKEN is not configured")
        _application = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).build()
        _application.add_handler(CommandHandler("start", start_command))
        _application.add_handler(CommandHandler("app", app_command))
        _application.add_handler(CommandHandler("help", help_command))
        _application.add_handler(CommandHandler("profile", profile_command))
        _application.add_handler(CommandHandler("referral", referral_command))
        _application.add_handler(CommandHandler("terms", terms_command))
        _application.add_handler(MessageHandler(filters.Text(["Support 💬"]), support_handler))
        _application.add_handler(PreCheckoutQueryHandler(pre_checkout_handler))
        _application.add_handler(MessageHandler(filters.SUCCESSFUL_PAYMENT, successful_payment_handler))
    return _application
