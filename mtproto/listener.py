"""
listener.py — Фаза 4: Авто-режим (Push Interception).
Слушает системные уведомления Telegram о днях рождения
и запускает авто-поздравление.
"""
import re
import asyncio
import aiohttp
import os
from telethon import TelegramClient, events
from telethon.sessions import StringSession

TG_API_ID = int(os.getenv("TG_API_ID"))
TG_API_HASH = os.getenv("TG_API_HASH")
CLOUDFLARE_API_URL = os.getenv("CLOUDFLARE_API_URL")  # URL вашего CF Worker
INTERNAL_TOKEN = os.getenv("INTERNAL_TOKEN")

# Паттерны уведомлений о ДР (рус. и англ. версии Telegram)
BIRTHDAY_PATTERNS = [
    r"(?P<name>.+?) (?:празднует|celebrates) день рождения",
    r"(?P<name>.+?) has a birthday today",
    r"Сегодня день рождения у (?P<name>.+)",
]


def extract_name_from_push(text: str) -> str | None:
    """Извлечь имя именинника из текста уведомления."""
    for pattern in BIRTHDAY_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group("name").strip()
    return None


async def check_and_congratulate(session_ref: str, friend_name: str):
    """Проверить антидубль в D1 и запустить отправку через CF Worker."""
    async with aiohttp.ClientSession() as http:
        # Уведомить CF Worker — он сам проверит антидубль и запустит отправку
        await http.post(
            f"{CLOUDFLARE_API_URL}/api/internal/auto-send",
            json={"session_ref": session_ref, "friend_name": friend_name},
            headers={"X-Internal-Token": INTERNAL_TOKEN}
        )


async def run_listener_for_user(session_string: str, session_ref: str):
    """Запустить слушатель пушей для одного пользователя."""
    client = TelegramClient(StringSession(session_string), TG_API_ID, TG_API_HASH)

    @client.on(events.NewMessage(incoming=True, from_users=["777000"]))  # 777000 — Telegram Notifications
    async def handler(event):
        text = event.raw_text
        name = extract_name_from_push(text)
        if name:
            print(f"[AutoMode] Birthday detected: {name}")
            await check_and_congratulate(session_ref, name)

    await client.start()
    print(f"[AutoMode] Listener started for session {session_ref[:8]}...")
    await client.run_until_disconnected()


async def fetch_decryption_key(url: str, token: str) -> str:
    """Получить мастер-ключ расшифровки из Cloudflare."""
    async with aiohttp.ClientSession() as http:
        async with http.get(url, headers={"X-Internal-Token": token}) as res:
            if res.status != 200:
                raise Exception(f"Failed to fetch key: {res.status}")
            data = await res.json()
            return data["key"]
