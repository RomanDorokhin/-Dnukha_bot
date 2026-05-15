# 🚀 Деплой BirthdayBot v1.1

## 1. Cloudflare Workers (Backend)

```bash
cd server
npm install
# Создать D1 базу:
npx wrangler d1 create birthday_db
# Скопировать ID из вывода → вставить в wrangler.toml → database_id

# Применить миграции:
npx wrangler d1 execute birthday_db --file=migrations/0001_initial.sql

# Добавить секреты:
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put INTERNAL_TOKEN
npx wrangler secret put DECRYPTION_KEY   # hex-строка 64 символа: openssl rand -hex 32
npx wrangler secret put BOT_TOKEN
npx wrangler secret put HETZNER_URL      # http://YOUR_VPS_IP:8000

# Деплой:
npx wrangler deploy
```

## 2. Hetzner VPS (MTProto Python)

```bash
# На сервере:
apt update && apt install -y python3.11 python3.11-venv nginx

# Клонировать репо:
git clone https://github.com/RomanDorokhin/-Dnukha_bot.git /opt/dnukha-bot
cd /opt/dnukha-bot/mtproto

# Виртуальное окружение:
python3.11 -m venv /opt/dnukha-bot/venv
/opt/dnukha-bot/venv/bin/pip install -r requirements.txt

# Настроить .env (скопировать из .env.example и заполнить):
cp .env.example .env
nano .env

# Настроить systemd:
cp dnukha-bot.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable dnukha-bot
systemctl start dnukha-bot

# Проверить:
systemctl status dnukha-bot
curl http://localhost:8000/health
```

## 3. Закрыть порт 8000 от публичного доступа

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw deny 8000
ufw enable
```

## 4. Frontend

```bash
cd client
npm install
# Для локальной разработки:
npm run dev

# Для деплоя (например, Cloudflare Pages):
npm run build
# Загрузить папку dist/ в Cloudflare Pages
```

## 5. Telegram Bot

1. Создать бота через @BotFather → получить `BOT_TOKEN`
2. Настроить Mini App: `/newapp` → указать URL задеплоенного фронтенда
3. Получить `api_id` и `api_hash` на https://my.telegram.org → вставить в `.env`

## Secrets Checklist

| Переменная | Где хранится | Описание |
|:---|:---|:---|
| `BOT_TOKEN` | CF Secrets | Токен Telegram бота |
| `OPENROUTER_API_KEY` | CF Secrets | Ключ OpenRouter |
| `INTERNAL_TOKEN` | CF Secrets + Hetzner `.env` | Общий токен для CF↔Hetzner |
| `DECRYPTION_KEY` | CF Secrets | AES-256 мастер-ключ (hex, 64 символа) |
| `TG_API_ID` | Hetzner `.env` | Telegram API ID |
| `TG_API_HASH` | Hetzner `.env` | Telegram API Hash |
| `CLOUDFLARE_DECRYPT_URL` | Hetzner `.env` | URL вашего CF Worker `/decrypt-key` |
