#!/usr/bin/env python3
"""
One-time setup script: registers the Telegram bot webhook and configures
the BotFather menu button to open the Mini App.

Usage:
    cd backend
    python scripts/setup_bot.py

Required env vars (read from .env):
    TELEGRAM_BOT_TOKEN     — bot token from @BotFather
    WEBHOOK_URL            — public HTTPS URL of this backend, e.g.
                             https://your-domain.com/api/v1/telegram/webhook
                             (use ngrok for local development)
    MINI_APP_URL           — URL of the Mini App frontend
    TELEGRAM_WEBHOOK_SECRET — random secret token for webhook validation
                              (only A-Z, a-z, 0-9, _ and - allowed by Telegram)
"""
import os
import re
import sys

import httpx
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
WEBHOOK_URL = os.environ.get("WEBHOOK_URL", "").strip()
MINI_APP_URL = os.environ.get("MINI_APP_URL", "https://prediction-market-nine-blond.vercel.app").strip()
WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "").strip()

if not BOT_TOKEN:
    sys.exit("Error: TELEGRAM_BOT_TOKEN is not set in .env")
if not WEBHOOK_URL:
    sys.exit("Error: WEBHOOK_URL is not set — set it to your public backend URL + /api/v1/telegram/webhook")
if not WEBHOOK_URL.startswith("https://"):
    sys.exit(f"Error: WEBHOOK_URL must start with https:// (got: {WEBHOOK_URL!r})")

# Telegram secret_token must match [A-Za-z0-9_-]{1,256}
if WEBHOOK_SECRET:
    sanitized = re.sub(r"[^A-Za-z0-9_\-]", "", WEBHOOK_SECRET)[:256]
    if sanitized != WEBHOOK_SECRET:
        print(f"  WARNING: TELEGRAM_WEBHOOK_SECRET contains invalid chars — sanitized from")
        print(f"    {WEBHOOK_SECRET!r}")
        print(f"  to")
        print(f"    {sanitized!r}")
        print(f"  Update TELEGRAM_WEBHOOK_SECRET in your .env AND in Render/hosting env vars to match.")
        WEBHOOK_SECRET = sanitized
    if not WEBHOOK_SECRET:
        sys.exit("Error: TELEGRAM_WEBHOOK_SECRET is set but contains no valid characters after sanitization.")

BASE = f"https://api.telegram.org/bot{BOT_TOKEN}"


def call(method: str, **payload) -> dict:
    resp = httpx.post(f"{BASE}/{method}", json=payload, timeout=10)
    if not resp.is_success:
        try:
            body = resp.json()
        except Exception:
            body = resp.text
        sys.exit(f"Telegram API {method} failed {resp.status_code}: {body}")
    data = resp.json()
    if not data.get("ok"):
        sys.exit(f"Telegram API error on {method}: {data}")
    return data["result"]


def main():
    print(f"WEBHOOK_URL   : {WEBHOOK_URL}")
    print(f"SECRET set    : {'yes (' + str(len(WEBHOOK_SECRET)) + ' chars)' if WEBHOOK_SECRET else 'no'}")
    print()

    # 1. Set webhook
    print(f"[1/3] Setting webhook...")
    kwargs = {"url": WEBHOOK_URL, "allowed_updates": ["message", "callback_query", "pre_checkout_query"]}
    if WEBHOOK_SECRET:
        kwargs["secret_token"] = WEBHOOK_SECRET
    call("setWebhook", **kwargs)
    print("      Done.")

    # 2. Set default menu button for all chats to open the Mini App
    print(f"[2/3] Setting menu button: WebApp ({MINI_APP_URL})")
    call(
        "setChatMenuButton",
        menu_button={"type": "web_app", "text": "Open App", "web_app": {"url": MINI_APP_URL}},
    )
    print("      Done.")

    # 3. Register bot commands
    print("[3/3] Registering bot commands")
    call(
        "setMyCommands",
        commands=[
            {"command": "start", "description": "Start the bot"},
            {"command": "app", "description": "Open the Prediction Market app"},
            {"command": "help", "description": "Show help"},
            {"command": "profile", "description": "Your stats"},
            {"command": "referral", "description": "Your referral link"},
        ],
    )
    print("      Done.")

    print("\nBot setup complete!")
    print(f"  Webhook : {WEBHOOK_URL}")
    print(f"  Mini App: {MINI_APP_URL}")

    # Show current webhook info
    info = call("getWebhookInfo")
    print(f"\nWebhook info:")
    print(f"  url              : {info.get('url')}")
    print(f"  allowed_updates  : {info.get('allowed_updates', [])}")
    print(f"  pending_updates  : {info.get('pending_update_count', 0)}")
    print(f"  last_error       : {info.get('last_error_message', 'none')}")
    print(f"  last_error_date  : {info.get('last_error_date', 'none')}")


if __name__ == "__main__":
    main()
