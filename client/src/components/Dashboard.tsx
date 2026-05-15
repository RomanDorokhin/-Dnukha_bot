import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface Birthday {
  id: number;
  friend_name: string;
  friend_username: string;
  relation_type: string;
  birth_date: string;
  send_time: string;
}

interface Props {
  onAdd: () => void;
  onSettings: () => void;
}

export default function Dashboard({ onAdd, onSettings }: Props) {
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [autoMode, setAutoMode] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getBirthdays(), api.getSettings()])
      .then(([bdays, settings]) => {
        setBirthdays(bdays);
        setAutoMode(settings.auto_mode === 1);
      })
      .finally(() => setLoading(false));
  }, []);

  async function toggleAutoMode() {
    const next = !autoMode;
    await api.updateSettings({ auto_mode: next ? 1 : 0 });
    setAutoMode(next);
  }

  const today = new Date();
  const todayStr = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const upcoming = [...birthdays].sort((a, b) => a.birth_date.localeCompare(b.birth_date));

  if (loading) return <div className="screen loading">Загружаю...</div>;

  return (
    <div className="screen">
      <div className="dashboard-header">
        <h1>🎂 Днюха</h1>
        <button className="avatar-btn" onClick={onSettings}>⚙️</button>
      </div>

      <div className="auto-mode-card">
        <div>
          <div className="card-title">Авто-поздравления</div>
          <div className="card-sub">{autoMode ? 'Включены — бот следит за днями рождения' : 'Выключены'}</div>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={autoMode} onChange={toggleAutoMode} />
          <span className="slider" />
        </label>
      </div>

      <div className="section-header">
        <span>Ближайшие дни рождения</span>
        <button className="btn-add" onClick={onAdd}>+ Добавить</button>
      </div>

      {upcoming.length === 0 ? (
        <div className="empty-state">
          <div>🎈</div>
          <p>Ещё никого нет.<br />Добавь первого именинника!</p>
          <button className="btn-primary" onClick={onAdd}>Добавить</button>
        </div>
      ) : (
        <div className="birthday-list">
          {upcoming.map(b => (
            <div key={b.id} className={`birthday-card ${b.birth_date === todayStr ? 'today' : ''}`}>
              <div className="bday-info">
                <div className="bday-name">{b.friend_name || b.friend_username}</div>
                <div className="bday-meta">{b.relation_type} · {b.birth_date} · {b.send_time}</div>
              </div>
              {b.birth_date === todayStr && <span className="badge-today">Сегодня!</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
