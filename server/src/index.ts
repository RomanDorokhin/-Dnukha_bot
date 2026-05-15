import { Hono } from 'hono';
import { generateGreeting } from './ai';

export type Bindings = {
  DB: D1Database;
  OPENROUTER_API_KEY: string;
  INTERNAL_TOKEN: string;
  DECRYPTION_KEY: string;
  HETZNER_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// ─── Middleware: Auth validation ───────────────────────────────────────────────
async function getTgUser(c: any): Promise<{ id: number; tg_id: string } | null> {
  // В реальном проекте тут валидация Telegram initData через HMAC-SHA256
  // Для скелета — принимаем tg_id из заголовка
  const tgId = c.req.header('X-Tg-Id');
  if (!tgId) return null;
  const user = await c.env.DB.prepare(
    'SELECT id, tg_id FROM users WHERE tg_id = ? AND is_active = 1'
  ).bind(tgId).first<{ id: number; tg_id: string }>();
  return user ?? null;
}

// ─── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/auth/init', async (c) => {
  const { phone, session_ref } = await c.req.json();
  const res = await fetch(`${c.env.HETZNER_URL}/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Token': c.env.INTERNAL_TOKEN },
    body: JSON.stringify({ phone, session_ref }),
  });
  const data = await res.json();
  return c.json(data);
});

app.post('/api/auth/verify', async (c) => {
  const { phone, code, phone_code_hash, session_ref, tg_id, tg_username, tg_name } = await c.req.json();
  const hetznerRes = await fetch(`${c.env.HETZNER_URL}/auth/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Token': c.env.INTERNAL_TOKEN },
    body: JSON.stringify({ session_ref, code, phone_code_hash }),
  });
  if (!hetznerRes.ok) return c.json({ error: 'Auth failed' }, 400);

  await c.env.DB.prepare(`
    INSERT INTO users (tg_id, tg_username, tg_name, session_ref)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(tg_id) DO UPDATE SET session_ref = excluded.session_ref, last_seen_at = datetime('now')
  `).bind(tg_id, tg_username, tg_name, session_ref).run();

  return c.json({ ok: true });
});

app.delete('/api/auth/logout', async (c) => {
  const user = await getTgUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  await c.env.DB.prepare('UPDATE users SET is_active = 0 WHERE id = ?').bind(user.id).run();
  return c.json({ ok: true });
});

// ─── Birthdays ─────────────────────────────────────────────────────────────────
app.get('/api/birthdays', async (c) => {
  const user = await getTgUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM birthdays WHERE user_id = ? AND is_active = 1 ORDER BY birth_date'
  ).bind(user.id).all();
  return c.json(results);
});

app.post('/api/birthdays', async (c) => {
  const user = await getTgUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json();
  const { friend_name, friend_username, relation_type, birth_date, send_time, use_ai, template_id } = body;
  const res = await c.env.DB.prepare(`
    INSERT INTO birthdays (user_id, friend_name, friend_username, relation_type, birth_date, send_time, use_ai, template_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(user.id, friend_name, friend_username, relation_type ?? 'знакомый', birth_date, send_time ?? '09:00', use_ai ?? 0, template_id ?? null).run();
  return c.json({ ok: true, id: res.meta.last_row_id });
});

app.put('/api/birthdays/:id', async (c) => {
  const user = await getTgUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const body = await c.req.json();
  const { friend_name, friend_username, relation_type, birth_date, send_time, use_ai, template_id } = body;
  await c.env.DB.prepare(`
    UPDATE birthdays SET friend_name=?, friend_username=?, relation_type=?, birth_date=?, send_time=?, use_ai=?, template_id=?
    WHERE id = ? AND user_id = ?
  `).bind(friend_name, friend_username, relation_type, birth_date, send_time, use_ai, template_id, id, user.id).run();
  return c.json({ ok: true });
});

app.delete('/api/birthdays/:id', async (c) => {
  const user = await getTgUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE birthdays SET is_active = 0 WHERE id = ? AND user_id = ?').bind(id, user.id).run();
  return c.json({ ok: true });
});

// ─── Templates ─────────────────────────────────────────────────────────────────
app.get('/api/templates', async (c) => {
  const user = await getTgUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM templates WHERE user_id = ? OR is_system = 1 ORDER BY is_system DESC, id'
  ).bind(user.id).all();
  return c.json(results);
});

app.post('/api/templates', async (c) => {
  const user = await getTgUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { title, body, use_name } = await c.req.json();
  const res = await c.env.DB.prepare(
    'INSERT INTO templates (user_id, title, body, use_name) VALUES (?, ?, ?, ?)'
  ).bind(user.id, title, body, use_name ?? 0).run();
  return c.json({ ok: true, id: res.meta.last_row_id });
});

app.delete('/api/templates/:id', async (c) => {
  const user = await getTgUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM templates WHERE id = ? AND user_id = ? AND is_system = 0').bind(id, user.id).run();
  return c.json({ ok: true });
});

// ─── AI Generation ─────────────────────────────────────────────────────────────
app.post('/api/ai/generate', async (c) => {
  const user = await getTgUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { relation_type, friend_name } = await c.req.json();
  const result = await generateGreeting(c.env.DB, c.env.OPENROUTER_API_KEY, user.id, relation_type, friend_name);
  return c.json(result);
});

// ─── Settings ──────────────────────────────────────────────────────────────────
app.get('/api/settings', async (c) => {
  const user = await getTgUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const data = await c.env.DB.prepare('SELECT tg_username, tg_name, auto_mode FROM users WHERE id = ?').bind(user.id).first();
  return c.json(data);
});

app.put('/api/settings', async (c) => {
  const user = await getTgUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { auto_mode } = await c.req.json();
  await c.env.DB.prepare('UPDATE users SET auto_mode = ? WHERE id = ?').bind(auto_mode, user.id).run();
  return c.json({ ok: true });
});

// ─── Send Log ──────────────────────────────────────────────────────────────────
app.get('/api/log', async (c) => {
  const user = await getTgUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM send_log WHERE user_id = ? ORDER BY sent_at DESC LIMIT 100'
  ).bind(user.id).all();
  return c.json(results);
});

// ─── Internal: Auto-send (от Hetzner listener) ─────────────────────────────────
app.post('/api/internal/auto-send', async (c) => {
  const token = c.req.header('X-Internal-Token');
  if (token !== c.env.INTERNAL_TOKEN) return c.text('Unauthorized', 401);

  const { session_ref, friend_name } = await c.req.json();
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE session_ref = ? AND is_active = 1 AND auto_mode = 1').bind(session_ref).first<{ id: number }>();
  if (!user) return c.json({ ok: false, reason: 'User not found or auto_mode off' });

  // Проверка антидубля
  const alreadySent = await c.env.DB.prepare(`
    SELECT id FROM send_log
    WHERE user_id = ? AND friend_username = ?
    AND strftime('%Y', sent_at) = strftime('%Y', 'now')
    AND status = 'ok'
  `).bind(user.id, friend_name).first();
  if (alreadySent) return c.json({ ok: false, reason: 'Already sent this year' });

  // Генерация текста
  const ai = await generateGreeting(c.env.DB, c.env.OPENROUTER_API_KEY, user.id, 'знакомый', friend_name);

  // Отправка через Hetzner
  const sendRes = await fetch(`${c.env.HETZNER_URL}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Token': c.env.INTERNAL_TOKEN },
    body: JSON.stringify({ session_ref, target_username: friend_name, text: ai.text }),
  });

  const status = sendRes.ok ? 'ok' : 'error';
  await c.env.DB.prepare(
    'INSERT INTO send_log (user_id, friend_username, mode, status) VALUES (?, ?, ?, ?)'
  ).bind(user.id, friend_name, 'auto_push', status).run();

  return c.json({ ok: sendRes.ok });
});

// ─── Decrypt Key (для Hetzner) ─────────────────────────────────────────────────
app.get('/decrypt-key', async (c) => {
  const token = c.req.header('X-Internal-Token');
  if (token !== c.env.INTERNAL_TOKEN) return c.text('Unauthorized', 401);
  return c.text(c.env.DECRYPTION_KEY);
});

// ─── Cron Handler ──────────────────────────────────────────────────────────────
async function handleScheduled(env: Bindings) {
  // Выборка именинников на ближайшие 30 минут (время по Москве = UTC+3)
  const { results } = await env.DB.prepare(`
    SELECT b.*, u.session_ref, u.id as uid
    FROM birthdays b
    JOIN users u ON b.user_id = u.id
    WHERE b.is_active = 1 AND u.is_active = 1
    AND strftime('%m-%d', 'now', '+3 hours') = b.birth_date
    AND time(b.send_time) BETWEEN time('now', '+3 hours', '-30 minutes')
                               AND time('now', '+3 hours', '+30 minutes')
    AND (b.last_sent_year IS NULL OR b.last_sent_year != strftime('%Y', 'now'))
  `).all<any>();

  for (const row of results) {
    // Проверка лимита: не более 10 отправок в сутки
    const today = await env.DB.prepare(`
      SELECT COUNT(*) as cnt FROM send_log
      WHERE user_id = ? AND sent_at > datetime('now', 'start of day') AND status = 'ok'
    `).bind(row.uid).first<{ cnt: number }>();
    if ((today?.cnt ?? 0) >= 10) continue;

    // Генерация поздравления
    const ai = await generateGreeting(env.DB, env.OPENROUTER_API_KEY, row.uid, row.relation_type, row.friend_name);

    // Отправка через Hetzner
    const sendRes = await fetch(`${env.HETZNER_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': env.INTERNAL_TOKEN },
      body: JSON.stringify({ session_ref: row.session_ref, target_username: row.friend_username, text: ai.text }),
    });

    const status = sendRes.ok ? 'ok' : 'error';

    // Логируем и обновляем last_sent_year
    await env.DB.batch([
      env.DB.prepare('INSERT INTO send_log (user_id, birthday_id, friend_username, mode, status) VALUES (?, ?, ?, ?, ?)')
        .bind(row.uid, row.id, row.friend_username, 'scheduled', status),
      env.DB.prepare("UPDATE birthdays SET last_sent_year = strftime('%Y', 'now') WHERE id = ?")
        .bind(row.id),
    ]);
  }
}

export default {
  fetch: app.fetch,
  async scheduled(_: ScheduledEvent, env: Bindings) {
    await handleScheduled(env);
  },
};
