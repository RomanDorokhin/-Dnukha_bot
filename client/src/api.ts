const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function apiCall(path: string, method = 'GET', body?: object) {
  const tgId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(tgId ? { 'X-Tg-Id': tgId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
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
