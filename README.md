# 🎂 BirthdayBot

Telegram Mini App для автоматизации поздравлений с использованием AI (Llama 3.1 8B).

## Структура
- `server/`: Cloudflare Workers (API + D1).
- `mtproto/`: Python сервис для работы с Telegram (Telethon).
- `client/`: React фронтенд (Mini App).

## Особенности
- **Авто-режим**: Перехват пушей Telegram о днях рождения.
- **AI Генерация**: Тексты на основе типа отношений (друг/коллега/и т.д.).
- **Безопасность**: Split-key архитектура шифрования сессий.

## Деплой
1. Настроить Cloudflare D1 и Secrets.
2. Запустить Python сервис на Hetzner.
3. Задеплоить фронтенд в Telegram.
