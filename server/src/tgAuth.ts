/**
 * auth.ts — Валидация Telegram initData через HMAC-SHA256.
 * Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

export async function validateTelegramInitData(
  initData: string,
  botToken: string
): Promise<{ valid: boolean; user: any | null }> {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false, user: null };

    // Собираем строку для проверки (все поля кроме hash, отсортированные по алфавиту)
    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    // HMAC-SHA256: ключ = HMAC("WebAppData", botToken), данные = dataCheckString
    const encoder = new TextEncoder();
    const secretKey = await crypto.subtle.importKey(
      'raw', encoder.encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const secretKeyBytes = await crypto.subtle.sign('HMAC', secretKey, encoder.encode(botToken));

    const dataKey = await crypto.subtle.importKey(
      'raw', secretKeyBytes,
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signatureBytes = await crypto.subtle.sign('HMAC', dataKey, encoder.encode(dataCheckString));

    // Сравниваем с hash из initData
    const computedHash = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (computedHash !== hash) return { valid: false, user: null };

    // Проверяем что данные не старше 24 часов
    const authDate = parseInt(params.get('auth_date') ?? '0', 10);
    if (Date.now() / 1000 - authDate > 86400) return { valid: false, user: null };

    const user = JSON.parse(params.get('user') ?? 'null');
    return { valid: true, user };
  } catch {
    return { valid: false, user: null };
  }
}

export function getAuthMiddleware(botToken: string) {
  return async (c: any, next: () => Promise<void>) => {
    const initData = c.req.header('X-Telegram-Init-Data');
    if (!initData) return c.json({ error: 'Missing initData' }, 401);

    const { valid, user } = await validateTelegramInitData(initData, botToken);
    if (!valid || !user) return c.json({ error: 'Invalid initData' }, 401);

    c.set('tgUser', user);
    await next();
  };
}
