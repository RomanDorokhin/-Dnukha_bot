-- Migration: 0001_initial.sql
-- BirthdayBot v1.1 — Cloudflare D1 Schema

CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_id        TEXT UNIQUE NOT NULL,
  tg_username  TEXT,
  tg_name      TEXT,
  phone_hash   TEXT,
  session_ref  TEXT,
  auto_mode    INTEGER DEFAULT 1,
  last_seen_at TEXT DEFAULT (datetime('now')),
  is_active    INTEGER DEFAULT 1,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS birthdays (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_name     TEXT,
  friend_username TEXT NOT NULL,
  relation_type   TEXT NOT NULL DEFAULT 'знакомый' CHECK(relation_type IN ('друг', 'коллега', 'знакомый', 'родственник')),
  birth_date      TEXT NOT NULL,  -- формат MM-DD
  send_time       TEXT NOT NULL DEFAULT '09:00',  -- HH:MM по Москве
  use_ai          INTEGER NOT NULL DEFAULT 0,
  template_id     INTEGER REFERENCES templates(id) ON DELETE SET NULL,
  last_sent_year  INTEGER,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS templates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,  -- NULL = системный шаблон
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  use_name    INTEGER NOT NULL DEFAULT 0,
  is_system   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS send_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  birthday_id     INTEGER REFERENCES birthdays(id) ON DELETE SET NULL,
  friend_username TEXT,
  mode            TEXT NOT NULL DEFAULT 'manual', -- 'auto_push' | 'manual' | 'scheduled'
  status          TEXT NOT NULL DEFAULT 'ok',     -- 'ok' | 'error'
  error_msg       TEXT,
  sent_at         TEXT DEFAULT (datetime('now'))
);

-- Системные шаблоны (is_system = 1)
INSERT OR IGNORE INTO templates (user_id, title, body, use_name, is_system) VALUES
  (NULL, 'Тёплое поздравление', 'С днём рождения! Желаю тебе всего самого лучшего.', 0, 1),
  (NULL, 'С именем', 'С днём рождения, {name}! Пусть этот день будет особенным.', 1, 1),
  (NULL, 'Коллеге', 'Поздравляю с днём рождения! Желаю профессиональных успехов и хорошего настроения.', 0, 1);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_birthdays_user_id ON birthdays(user_id);
CREATE INDEX IF NOT EXISTS idx_birthdays_birth_date ON birthdays(birth_date);
CREATE INDEX IF NOT EXISTS idx_send_log_user_id ON send_log(user_id);
CREATE INDEX IF NOT EXISTS idx_send_log_sent_at ON send_log(sent_at);
