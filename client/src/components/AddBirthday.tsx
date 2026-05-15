import React, { useState } from 'react';
import { api } from '../api';

type RelationType = 'друг' | 'коллега' | 'знакомый' | 'родственник';

const RELATIONS: RelationType[] = ['друг', 'коллега', 'знакомый', 'родственник'];

interface Props {
  onSave: () => void;
  onCancel: () => void;
}

export default function AddBirthday({ onSave, onCancel }: Props) {
  const [friendUsername, setFriendUsername] = useState('');
  const [friendName, setFriendName] = useState('');
  const [relation, setRelation] = useState<RelationType>('знакомый');
  const [birthDate, setBirthDate] = useState('');
  const [sendTime, setSendTime] = useState('09:00');
  const [useAi, setUseAi] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleGenerate() {
    setAiLoading(true);
    try {
      const res = await api.generateGreeting(relation, friendName || undefined);
      setAiText(res.text);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.addBirthday({
        friend_username: friendUsername,
        friend_name: friendName,
        relation_type: relation,
        birth_date: birthDate,
        send_time: sendTime,
        use_ai: useAi ? 1 : 0,
      });
      onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="btn-back" onClick={onCancel}>←</button>
        <h2>Добавить день рождения</h2>
      </div>

      <div className="form">
        <label>@username или имя контакта *</label>
        <input
          value={friendUsername}
          onChange={e => setFriendUsername(e.target.value)}
          placeholder="@ivan_ivanov"
        />

        <label>Как обращаться (опционально)</label>
        <input
          value={friendName}
          onChange={e => setFriendName(e.target.value)}
          placeholder="Ваня"
        />

        <label>Тип отношений</label>
        <div className="relation-selector">
          {RELATIONS.map(r => (
            <button
              key={r}
              className={`relation-btn ${relation === r ? 'active' : ''}`}
              onClick={() => setRelation(r)}
            >
              {r}
            </button>
          ))}
        </div>

        <label>Дата рождения *</label>
        <input
          type="text"
          value={birthDate}
          onChange={e => setBirthDate(e.target.value)}
          placeholder="MM-DD (пример: 05-15)"
        />

        <label>Время отправки (по Москве)</label>
        <input
          type="time"
          value={sendTime}
          onChange={e => setSendTime(e.target.value)}
        />

        <div className="ai-toggle-row">
          <span>Использовать AI для генерации текста</span>
          <label className="toggle">
            <input type="checkbox" checked={useAi} onChange={e => setUseAi(e.target.checked)} />
            <span className="slider" />
          </label>
        </div>

        {useAi && (
          <div className="ai-section">
            <button className="btn-secondary" onClick={handleGenerate} disabled={aiLoading}>
              {aiLoading ? 'Генерирую...' : 'Сгенерировать текст'}
            </button>

            {aiText && (
              <div className="ai-result-card">
                <textarea
                  value={aiText}
                  onChange={e => setAiText(e.target.value)}
                  rows={4}
                />
                <div className="ai-result-actions">
                  <button className="btn-ghost" onClick={handleGenerate} disabled={aiLoading}>
                    Ещё вариант
                  </button>
                  <button className="btn-primary" onClick={() => {}}>
                    Использовать
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          className="btn-primary btn-full"
          onClick={handleSave}
          disabled={!friendUsername || !birthDate || saving}
        >
          {saving ? 'Сохраняю...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
