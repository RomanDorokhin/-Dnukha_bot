import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
  OPENROUTER_API_KEY: string;
  INTERNAL_TOKEN: string;
  DECRYPTION_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// 1. Auth & Session
app.post('/api/auth/verify', async (c) => {
  // Logic for verifying Telegram code and saving user
  return c.json({ ok: true });
});

// 2. AI Generation (Llama 3.1 8B)
app.post('/api/ai/generate', async (c) => {
  const { relation_type, friend_name } = await c.req.json();
  const prompt = `Напиши короткое (1-3 предл.) поздравление с днем рождения для ${friend_name}. 
                 Отношения: ${relation_type}. Стиль: теплый, без клише.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data: any = await response.json();
    return c.json({ text: data.choices[0].message.content });
  } catch (e) {
    // Fallback logic could go here
    return c.json({ error: 'AI failed' }, 500);
  }
});

// 3. Decrypt Key for Hetzner
app.get('/decrypt-key', async (c) => {
  const token = c.req.header('X-Internal-Token');
  if (token !== c.env.INTERNAL_TOKEN) return c.text('Unauthorized', 401);
  return c.text(c.env.DECRYPTION_KEY);
});

export default app;
