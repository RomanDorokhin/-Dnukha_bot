"""
main.py — FastAPI сервер Hetzner VPS.
Принимает запросы от Cloudflare Workers (авторизация, отправка сообщений).
Все входящие запросы проверяются по X-Internal-Token.
"""
import os
import asyncio
from fastapi import FastAPI, Header, HTTPException, BackgroundTasks
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

import auth
import sender
import listener
import sqlite3

app = FastAPI(title="BirthdayBot MTProto Layer", version="1.1.0")

# Воркеры слушателей
_listeners: dict[str, asyncio.Task] = {}

async def startup_listeners():
    """Запуск слушателей для всех сессий в БД при старте."""
    db = auth._get_db()
    rows = db.execute("SELECT session_ref, encrypted FROM sessions").fetchall()
    db.close()
    
    key = await listener.fetch_decryption_key(CLOUDFLARE_DECRYPT_URL, INTERNAL_TOKEN)
    
    for session_ref, encrypted in rows:
        try:
            session_string = listener.decrypt_session(encrypted, key)
            task = asyncio.create_task(listener.run_listener_for_user(session_string, session_ref))
            _listeners[session_ref] = task
        except Exception as e:
            print(f"Failed to start listener for {session_ref}: {e}")

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(startup_listeners())

INTERNAL_TOKEN = os.getenv("INTERNAL_TOKEN")
CLOUDFLARE_DECRYPT_URL = os.getenv("CLOUDFLARE_DECRYPT_URL")


def verify_token(token: str | None):
    if token != INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")


# ─── Auth Endpoints ────────────────────────────────────────────────────────────

class SendCodeRequest(BaseModel):
    phone: str
    session_ref: str

class VerifyCodeRequest(BaseModel):
    session_ref: str
    code: str
    phone_code_hash: str

class LogoutRequest(BaseModel):
    session_ref: str


@app.post("/auth/send-code")
async def send_code(body: SendCodeRequest, x_internal_token: str = Header(None)):
    verify_token(x_internal_token)
    try:
        phone_code_hash = await auth.send_code(body.phone, body.session_ref)
        return {"ok": True, "phone_code_hash": phone_code_hash}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/auth/verify-code")
async def verify_code(body: VerifyCodeRequest, x_internal_token: str = Header(None)):
    verify_token(x_internal_token)
    try:
        await auth.verify_code(
            body.session_ref, body.code, body.phone_code_hash,
            CLOUDFLARE_DECRYPT_URL, INTERNAL_TOKEN
        )
        
        # Сразу запускаем слушателя для новой сессии
        encrypted = auth.get_encrypted_session(body.session_ref)
        key = await listener.fetch_decryption_key(CLOUDFLARE_DECRYPT_URL, INTERNAL_TOKEN)
        session_string = listener.decrypt_session(encrypted, key)
        task = asyncio.create_task(listener.run_listener_for_user(session_string, body.session_ref))
        _listeners[body.session_ref] = task
        
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/auth/logout")
async def logout(body: LogoutRequest, x_internal_token: str = Header(None)):
    verify_token(x_internal_token)
    await auth.logout(body.session_ref)
    return {"ok": True}


# ─── Send Endpoint ─────────────────────────────────────────────────────────────

class SendRequest(BaseModel):
    session_ref: str
    target_username: str
    text: str


@app.post("/send")
async def send(body: SendRequest, x_internal_token: str = Header(None)):
    verify_token(x_internal_token)
    result = await sender.send_message(body.session_ref, body.target_username, body.text)
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["msg"])
    return {"ok": True}


# ─── Health Check ──────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.1.0"}
