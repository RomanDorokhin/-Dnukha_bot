"""
auth.py — Авторизация пользователей через Telethon (MTProto).
Хранит временные сессии в памяти до успешного verify, затем
шифрует и сохраняет session_string в локальный SQLite.
"""
import sqlite3
import os
from telethon import TelegramClient
from telethon.sessions import StringSession
from crypto import encrypt_session, fetch_decryption_key

DB_PATH = os.getenv("SESSIONS_DB_PATH", "sessions.db")
TG_API_ID = int(os.getenv("TG_API_ID"))
TG_API_HASH = os.getenv("TG_API_HASH")

# Временное хранилище клиентов до завершения авторизации
_pending_clients: dict[str, TelegramClient] = {}


def _get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_ref TEXT PRIMARY KEY,
            encrypted   TEXT NOT NULL,
            created_at  TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    return conn


async def send_code(phone: str, session_ref: str) -> str:
    """Инициировать авторизацию. Возвращает phone_code_hash."""
    client = TelegramClient(StringSession(), TG_API_ID, TG_API_HASH)
    await client.connect()
    result = await client.send_code_request(phone)
    _pending_clients[session_ref] = (client, phone)
    return result.phone_code_hash


async def verify_code(
    session_ref: str,
    code: str,
    phone_code_hash: str,
    cloudflare_url: str,
    internal_token: str
) -> bool:
    """Подтвердить код. При успехе шифрует и сохраняет сессию."""
    if session_ref not in _pending_clients:
        raise ValueError("Session not found. Call send_code first.")

    client, phone = _pending_clients[session_ref]
    await client.sign_in(phone=phone, code=code, phone_code_hash=phone_code_hash)

    session_string = client.session.save()
    await client.disconnect()
    del _pending_clients[session_ref]

    # Получить ключ у Cloudflare и зашифровать
    key = await fetch_decryption_key(cloudflare_url, internal_token)
    encrypted = encrypt_session(session_string, key)

    db = _get_db()
    db.execute(
        "INSERT OR REPLACE INTO sessions (session_ref, encrypted) VALUES (?, ?)",
        (session_ref, encrypted)
    )
    db.commit()
    db.close()
    return True


async def logout(session_ref: str) -> bool:
    """Удалить сессию из хранилища."""
    db = _get_db()
    db.execute("DELETE FROM sessions WHERE session_ref = ?", (session_ref,))
    db.commit()
    db.close()
    return True


def get_encrypted_session(session_ref: str) -> str | None:
    """Получить зашифрованную сессию из БД."""
    db = _get_db()
    row = db.execute(
        "SELECT encrypted FROM sessions WHERE session_ref = ?", (session_ref,)
    ).fetchone()
    db.close()
    return row[0] if row else None
