import React, { useState } from 'react';

type Step = 'welcome' | 'phone' | 'code' | 'done';

interface Props {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState<Step>('welcome');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeHash, setCodeHash] = useState('');
  const [sessionRef] = useState(() => crypto.randomUUID());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;

  async function handleSendCode() {
    if (!phone.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': (window as any).Telegram?.WebApp?.initData ?? '',
        },
        body: JSON.stringify({ phone: phone.trim(), session_ref: sessionRef }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка');
      setCodeHash(data.phone_code_hash);
      setStep('code');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': (window as any).Telegram?.WebApp?.initData ?? '',
        },
        body: JSON.stringify({
          phone: phone.trim(),
          code: code.trim(),
          phone_code_hash: codeHash,
          session_ref: sessionRef,
          tg_id: String(tgUser?.id ?? ''),
          tg_username: tgUser?.username ?? '',
          tg_name: [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' '),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Неверный код');
      setStep('done');
      setTimeout(onComplete, 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Welcome ──────────────────────────────────────────────────
  if (step === 'welcome') return (
    <div className="onboarding">
      <div className="ob-hero">🎂</div>
      <h1 className="ob-title">Днюха</h1>
      <p className="ob-sub">Бот сам поздравит твоих друзей с днём рождения — вовремя и с душой.</p>

      <div className="ob-features">
        {[
          { icon: '🤖', text: 'Авто-режим — перехватывает уведомления Telegram' },
          { icon: '✍️', text: 'Пиши вручную — настрой список сам' },
          { icon: '✨', text: 'AI пишет поздравления под стиль отношений' },
          { icon: '🔒', text: 'Сессия зашифрована — мы не читаем твои чаты' },
        ].map(f => (
          <div key={f.icon} className="ob-feature">
            <span className="ob-feature-icon">{f.icon}</span>
            <span>{f.text}</span>
          </div>
        ))}
      </div>

      <button className="btn-primary btn-full ob-btn" onClick={() => setStep('phone')}>
        Начать
      </button>
      <p className="ob-legal">
        Нажимая «Начать», ты соглашаешься с{' '}
        <a href="#">Политикой конфиденциальности</a>
      </p>
    </div>
  );

  // ── Phone ────────────────────────────────────────────────────
  if (step === 'phone') return (
    <div className="onboarding onboarding--center">
      <div className="ob-hero">📱</div>
      <h2>Введи номер телефона</h2>
      <p className="ob-sub">Тот же номер, что привязан к твоему Telegram-аккаунту.</p>

      <div className="ob-input-group">
        <input
          className="ob-input"
          type="tel"
          placeholder="+7 900 000 00 00"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSendCode()}
          autoFocus
        />
        {error && <p className="ob-error">{error}</p>}
      </div>

      <button className="btn-primary btn-full ob-btn" onClick={handleSendCode} disabled={loading || !phone.trim()}>
        {loading ? 'Отправляю код...' : 'Получить код'}
      </button>
    </div>
  );

  // ── Code ─────────────────────────────────────────────────────
  if (step === 'code') return (
    <div className="onboarding onboarding--center">
      <div className="ob-hero">💬</div>
      <h2>Введи код из Telegram</h2>
      <p className="ob-sub">Telegram прислал тебе код — найди его в чате «Telegram» или на другом устройстве.</p>

      <a
        className="ob-tg-link"
        href="tg://resolve?domain=telegram"
      >
        Открыть Telegram →
      </a>

      <div className="ob-input-group">
        <input
          className="ob-input ob-input--code"
          type="text"
          inputMode="numeric"
          placeholder="12345"
          maxLength={6}
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          autoFocus
        />
        {error && <p className="ob-error">{error}</p>}
      </div>

      <button className="btn-primary btn-full ob-btn" onClick={handleVerifyCode} disabled={loading || code.length < 4}>
        {loading ? 'Проверяю...' : 'Подтвердить'}
      </button>
      <button className="btn-ghost ob-btn-back" onClick={() => { setStep('phone'); setError(''); }}>
        ← Другой номер
      </button>
    </div>
  );

  // ── Done ─────────────────────────────────────────────────────
  return (
    <div className="onboarding onboarding--center">
      <div className="ob-hero">🎉</div>
      <h2>Готово!</h2>
      <p className="ob-sub">Аккаунт подключён. Бот начнёт следить за днями рождения.</p>
    </div>
  );
}
