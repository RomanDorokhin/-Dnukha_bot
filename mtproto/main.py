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

app = FastAPI(title="BirthdayBot MTProto Layer", version="1.1.0")

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
