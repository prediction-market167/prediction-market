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
"""
import os
import sys

import httpx
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
WEBHOOK_URL = os.environ.get("WEBHOOK_URL")
MINI_APP_URL = os.environ.get("MINI_APP_URL", "https://prediction-market-nine-blond.vercel.app")
WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")

if not BOT_TOKEN:
    sys.exit("Error: TELEGRAM_BOT_TOKEN is not set in .env")
if not WEBHOOK_URL:
    sys.exit("Error: WEBHOOK_URL is not set in .env — set it to your public backend URL + /api/v1/telegram/webhook")

BASE = f"https://api.telegram.org/bot{BOT_TOKEN}"


def call(method: str, **payload) -> dict:
    resp = httpx.post(f"{BASE}/{method}", json=payload, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    if not data.get("ok"):
        sys.exit(f"Telegram API error on {method}: {data}")
    return data["result"]


def main():
    # 1. Set webhook
    print(f"[1/3] Setting webhook: {WEBHOOK_URL}")
    kwargs = {"url": WEBHOOK_URL, "allowed_updates": ["message", "callback_query"]}
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
    print(f"  pending_updates  : {info.get('pending_update_count', 0)}")
    print(f"  last_error       : {info.get('last_error_message', 'none')}")


if __name__ == "__main__":
    main()
