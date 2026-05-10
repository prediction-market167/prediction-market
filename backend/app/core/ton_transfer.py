"""
Send TON from the master wallet to a recipient using tonsdk + TonCenter API.
"""
import os
import httpx
from decimal import Decimal

from tonsdk.contract.wallet import WalletVersionEnum, Wallets
from tonsdk.utils import to_nano
from tonsdk.crypto import mnemonic_to_wallet_key


TONCENTER_API = "https://toncenter.com/api/v2"
TONCENTER_TESTNET_API = "https://testnet.toncenter.com/api/v2"


def _get_api_url() -> str:
    if os.getenv("TON_TESTNET", "").lower() in ("1", "true", "yes"):
        return TONCENTER_TESTNET_API
    return TONCENTER_API


def _get_api_key() -> dict:
    key = os.getenv("TONCENTER_API_KEY", "")
    return {"api_key": key} if key else {}


async def send_ton(recipient_address: str, amount_ton: Decimal) -> str:
    """
    Send TON from the master wallet.  Returns the tx hash (BOC hash) on success.
    Raises RuntimeError on failure.
    """
    mnemonic_raw = os.getenv("MASTER_ADMIN_MNEMONIC", "")
    if not mnemonic_raw:
        raise RuntimeError("MASTER_ADMIN_MNEMONIC not set")

    words = mnemonic_raw.strip().split()
    if len(words) != 24:
        raise RuntimeError(f"MASTER_ADMIN_MNEMONIC must be 24 words, got {len(words)}")

    # Derive keypair and wallet
    pub_key, priv_key = mnemonic_to_wallet_key(words)
    _mnemonics, pub_key, priv_key, wallet = Wallets.from_mnemonics(
        words, WalletVersionEnum.v4r2, workchain=0
    )

    wallet_address = wallet.address.to_string(True, True, False)
    api_url = _get_api_url()
    params = _get_api_key()

    async with httpx.AsyncClient(timeout=30) as client:
        # Get current seqno
        resp = await client.get(
            f"{api_url}/runGetMethod",
            params={**params, "address": wallet_address, "method": "seqno", "stack": "[]"},
        )
        resp.raise_for_status()
        data = resp.json()
        if not data.get("ok"):
            raise RuntimeError(f"TonCenter seqno error: {data}")

        stack = data["result"]["stack"]
        seqno = int(stack[0][1], 16) if stack else 0

        # Build transfer
        amount_nano = to_nano(float(amount_ton), "ton")
        query = wallet.create_transfer_message(
            to_addr=recipient_address,
            amount=amount_nano,
            seqno=seqno,
            payload="Withdrawal",
        )
        boc_b64 = query["message"].to_boc(False).hex()
        # TonCenter expects base64
        import base64
        boc_bytes = bytes.fromhex(boc_b64)
        boc_b64_str = base64.b64encode(boc_bytes).decode()

        # Broadcast
        send_resp = await client.post(
            f"{api_url}/sendBoc",
            params=params,
            json={"boc": boc_b64_str},
        )
        send_resp.raise_for_status()
        send_data = send_resp.json()
        if not send_data.get("ok"):
            raise RuntimeError(f"TonCenter sendBoc error: {send_data}")

        # Return hash of the BOC as tx reference
        import hashlib
        tx_hash = hashlib.sha256(boc_bytes).hexdigest()[:64]
        return tx_hash
