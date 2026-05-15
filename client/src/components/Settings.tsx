import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface LogEntry {
  id: number;
  friend_username: string;
  mode: string;
  status: string;
  sent_at: string;
}

interface Props {
  onBack: () => void;
}

export default function Settings({ onBack }: Props) {
  const [settings, setSettings] = useState<any>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [tab, setTab] = useState<'main' | 'log'>('main');

  useEffect(() => {
    api.getSettings().then(setSettings);
    api.getLog().then(setLog);
  }, []);

  const modeLabel: Record<string, string> = {
    auto_push: '🤖 Авто',
    scheduled: '📅 По расписанию',
    manual: '✋ Вручную',
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="btn-back" onClick={onBack}>←</button>
        <h2>Настройки</h2>
      </div>

      <div className="tab-bar">
        <button className={tab === 'main' ? 'active' : ''} onClick={() => setTab('main')}>Профиль</button>
        <button className={tab === 'log' ? 'active' : ''} onClick={() => setTab('log')}>История</button>
      </div>

      {tab === 'main' && settings && (
        <div className="settings-content">
          <div className="profile-card">
            <div className="avatar">👤</div>
            <div>
              <div className="profile-name">{settings.tg_name || 'Пользователь'}</div>
              <div className="profile-username">@{settings.tg_username}</div>
            </div>
          </div>

          <div className="settings-note">
            Поле «Мой стиль» недоступно в этой версии.
          </div>

          <button className="btn-danger" onClick={() => api.logout()}>
            Выйти из аккаунта
          </button>
        </div>
      )}

      {tab === 'log' && (
        <div className="log-list">
          {log.length === 0 ? (
            <p className="empty-log">Отправок пока не было.</p>
          ) : (
            log.map(entry => (
              <div key={entry.id} className={`log-entry status-${entry.status}`}>
                <div className="log-name">{entry.friend_username}</div>
                <div className="log-meta">
                  {modeLabel[entry.mode] ?? entry.mode} · {entry.sent_at.slice(0, 16)} · {entry.status === 'ok' ? '✅' : '❌'}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
