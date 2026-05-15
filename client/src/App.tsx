import React, { useEffect, useState } from 'react';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import AddBirthday from './components/AddBirthday';
import Settings from './components/Settings';
import Templates from './components/Templates';
import './App.css';

type Screen = 'loading' | 'onboarding' | 'dashboard' | 'add' | 'settings' | 'templates';

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');

  useEffect(() => {
    // Проверяем — есть ли пользователь в БД (авторизован ли он)
    const initData = (window as any).Telegram?.WebApp?.initData ?? '';
    fetch('/api/settings', {
      headers: { 'X-Telegram-Init-Data': initData },
    })
      .then(res => res.json())
      .then(data => {
        if (data.has_session) setScreen('dashboard');
        else setScreen('onboarding');
      })
      .catch(() => setScreen('onboarding'));
  }, []);

  if (screen === 'loading') {
    return (
      <div className="splash">
        <div className="splash-icon">🎂</div>
        <div className="splash-loader" />
      </div>
    );
  }

  return (
    <div className="app">
      {screen === 'onboarding' && (
        <Onboarding onComplete={() => setScreen('dashboard')} />
      )}
      {screen === 'dashboard' && (
        <Dashboard
          onAdd={() => setScreen('add')}
          onSettings={() => setScreen('settings')}
          onTemplates={() => setScreen('templates')}
        />
      )}
      {screen === 'add' && (
        <AddBirthday
          onSave={() => setScreen('dashboard')}
          onCancel={() => setScreen('dashboard')}
        />
      )}
      {screen === 'settings' && (
        <Settings onBack={() => setScreen('dashboard')} />
      )}
      {screen === 'templates' && (
        <Templates onBack={() => setScreen('dashboard')} />
      )}
    </div>
  );
}
