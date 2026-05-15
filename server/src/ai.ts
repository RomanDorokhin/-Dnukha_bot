/**
 * ai.ts — AI генерация поздравлений через OpenRouter.
 * Логика тона на основе relation_type, Fallback-цепочка, Rate Limiting.
 */

type Bindings = {
  DB: D1Database;
  OPENROUTER_API_KEY: string;
};

type RelationType = 'друг' | 'коллега' | 'знакомый' | 'родственник';

const MODELS = {
  primary: 'meta-llama/llama-3.1-8b-instruct:free',
  fallback: 'google/gemma-2-9b-it:free',
};

const TONE_MAP: Record<RelationType, string> = {
  'друг': 'тёплый, личный, допустим лёгкий юмор. Можно обращаться на "ты".',
  'коллега': 'уважительный, профессиональный, без фамильярности. На "вы" или "ты" — нейтрально.',
  'знакомый': 'нейтральный, короткий, вежливый. Без лишних эмоций.',
  'родственник': 'сердечный, искренний, тёплый. С любовью и заботой.',
};

function buildPrompt(relationType: RelationType, friendName?: string): string {
  const tone = TONE_MAP[relationType] ?? TONE_MAP['знакомый'];
  const nameClause = friendName ? ` для ${friendName}` : '';
  return `Напиши поздравление с днём рождения${nameClause}. 
Стиль: ${tone}
Правила: ровно 1-3 предложения, без клише ("счастья-здоровья", "всего наилучшего"), 
максимум 1 восклицательный знак, только русский язык. 
Отвечай ТОЛЬКО текстом поздравления, без кавычек и пояснений.`;
}

async function callOpenRouter(prompt: string, model: string, apiKey: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://dnukha-bot.workers.dev',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.85,
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response from AI');
  return text;
}

async function getSystemFallback(db: D1Database): Promise<string> {
  const row = await db.prepare(
    "SELECT body FROM templates WHERE is_system = 1 AND use_name = 0 ORDER BY id LIMIT 1"
  ).first<{ body: string }>();
  return row?.body ?? 'С днём рождения! Пусть этот день принесёт много радости.';
}

async function checkRateLimit(db: D1Database, userId: number): Promise<boolean> {
  const count = await db.prepare(`
    SELECT COUNT(*) as cnt FROM send_log
    WHERE user_id = ? AND mode = 'ai_generate'
    AND sent_at > datetime('now', '-1 hour')
  `).bind(userId).first<{ cnt: number }>();
  return (count?.cnt ?? 0) < 10; // Лимит: 10 генераций в час
}

export async function generateGreeting(
  db: D1Database,
  apiKey: string,
  userId: number,
  relationType: RelationType,
  friendName?: string
): Promise<{ text: string; model: string; fromFallback: boolean }> {
  // 1. Проверка Rate Limit
  const allowed = await checkRateLimit(db, userId);
  if (!allowed) {
    const fallbackText = await getSystemFallback(db);
    return { text: fallbackText, model: 'system_template', fromFallback: true };
  }

  const prompt = buildPrompt(relationType, friendName);

  // 2. Попытка с основной моделью (Llama 3.1)
  try {
    const text = await callOpenRouter(prompt, MODELS.primary, apiKey);
    return { text, model: MODELS.primary, fromFallback: false };
  } catch (e1) {
    // 3. Fallback на Gemma 2
    try {
      const text = await callOpenRouter(prompt, MODELS.fallback, apiKey);
      return { text, model: MODELS.fallback, fromFallback: true };
    } catch (e2) {
      // 4. Финальный Fallback — системный шаблон
      const text = await getSystemFallback(db);
      return { text, model: 'system_template', fromFallback: true };
    }
  }
}
