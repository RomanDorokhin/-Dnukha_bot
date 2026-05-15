"""
crypto.py — AES-256-GCM шифрование/расшифровка session strings.
Split-key архитектура: ключ хранится в Cloudflare Secrets,
данные — на Hetzner. Ключ запрашивается только в момент отправки.
"""
import os
import base64
import aiohttp
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def encrypt_session(session_string: str, key_hex: str) -> str:
    """Зашифровать session string ключом AES-256-GCM."""
    key = bytes.fromhex(key_hex)
    nonce = os.urandom(12)  # 96-bit nonce для GCM
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, session_string.encode(), None)
    # Формат хранения: base64(nonce + ciphertext)
    return base64.b64encode(nonce + ciphertext).decode()


def decrypt_session(encrypted: str, key_hex: str) -> str:
    """Расшифровать session string. Ключ живёт в памяти доли секунды."""
    key = bytes.fromhex(key_hex)
    raw = base64.b64decode(encrypted)
    nonce, ciphertext = raw[:12], raw[12:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, None).decode()


async def fetch_decryption_key(cloudflare_url: str, internal_token: str) -> str:
    """Запросить мастер-ключ у Cloudflare Worker."""
    async with aiohttp.ClientSession() as session:
        async with session.get(
            cloudflare_url,
            headers={"X-Internal-Token": internal_token},
            timeout=aiohttp.ClientTimeout(total=5)
        ) as resp:
            if resp.status != 200:
                raise RuntimeError(f"Failed to fetch decrypt key: {resp.status}")
            return await resp.text()
