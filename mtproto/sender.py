"""
sender.py — Отправка сообщений через Telethon.
Выполняет расшифровку сессии, отправку, логирование.
"""
import asyncio
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.errors import FloodWaitError
import os
from crypto import decrypt_session, fetch_decryption_key
from auth import get_encrypted_session

TG_API_ID = int(os.getenv("TG_API_ID"))
TG_API_HASH = os.getenv("TG_API_HASH")
CLOUDFLARE_DECRYPT_URL = os.getenv("CLOUDFLARE_DECRYPT_URL")
INTERNAL_TOKEN = os.getenv("INTERNAL_TOKEN")


async def send_message(session_ref: str, target_username: str, text: str) -> dict:
    """
    Отправить сообщение от имени пользователя.
    Расшифровывает сессию на лету — ключ живёт в памяти доли секунды.
    """
    encrypted = get_encrypted_session(session_ref)
    if not encrypted:
        return {"status": "error", "msg": "Session not found"}

    # Получить ключ и расшифровать сессию
    key = await fetch_decryption_key(CLOUDFLARE_DECRYPT_URL, INTERNAL_TOKEN)
    session_string = decrypt_session(encrypted, key)
    key = None  # Сразу очищаем ключ из памяти

    client = TelegramClient(StringSession(session_string), TG_API_ID, TG_API_HASH)
    try:
        await client.connect()
        await client.send_message(target_username, text)
        return {"status": "ok"}
    except FloodWaitError as e:
        return {"status": "error", "msg": f"FloodWait {e.seconds}s"}
    except Exception as e:
        return {"status": "error", "msg": str(e)}
    finally:
        await client.disconnect()
        session_string = None  # Очищаем сессию из памяти
