function getInitData(): string {
  const raw = (window as any).Telegram?.WebApp?.initData ?? '';
  try {
    return encodeURIComponent(raw);
  } catch {
    return '';
  }
}

async function apiCall(path: string, method = 'GET', body?: object) {
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': getInitData(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `API error ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  sendCode: (phone: string, sessionRef: string) =>
    apiCall('/api/auth/init', 'POST', { phone, session_ref: sessionRef }),
  verifyCode: (data: object) => apiCall('/api/auth/verify', 'POST', data),
  logout: () => apiCall('/api/auth/logout', 'DELETE'),

  // Birthdays
  getBirthdays: () => apiCall('/api/birthdays'),
  addBirthday: (data: object) => apiCall('/api/birthdays', 'POST', data),
  updateBirthday: (id: number, data: object) => apiCall(`/api/birthdays/${id}`, 'PUT', data),
  deleteBirthday: (id: number) => apiCall(`/api/birthdays/${id}`, 'DELETE'),

  // Templates
  getTemplates: () => apiCall('/api/templates'),
  addTemplate: (data: object) => apiCall('/api/templates', 'POST', data),
  deleteTemplate: (id: number) => apiCall(`/api/templates/${id}`, 'DELETE'),

  // AI
  generateGreeting: (relationType: string, friendName?: string) =>
    apiCall('/api/ai/generate', 'POST', { relation_type: relationType, friend_name: friendName }),

  // Settings & Log
  getSettings: () => apiCall('/api/settings'),
  updateSettings: (data: object) => apiCall('/api/settings', 'PUT', data),
  getLog: () => apiCall('/api/log'),
};
