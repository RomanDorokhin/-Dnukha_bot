import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface Template {
  id: number;
  title: string;
  body: string;
  use_name: number;
  is_system: number;
}

interface Props {
  onBack: () => void;
}

export default function Templates({ onBack }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [useName, setUseName] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await api.getTemplates();
    setTemplates(data);
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    await api.addTemplate({ title, body, use_name: useName ? 1 : 0 });
    setTitle(''); setBody(''); setUseName(false);
    setCreating(false);
    await load();
    setSaving(false);
  }

  async function handleDelete(id: number) {
    await api.deleteTemplate(id);
    await load();
  }

  const userTemplates = templates.filter(t => !t.is_system);
  const systemTemplates = templates.filter(t => t.is_system);

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="btn-back" onClick={onBack}>←</button>
        <h2>Шаблоны</h2>
        <button className="btn-add" onClick={() => setCreating(true)}>+ Новый</button>
      </div>

      {creating && (
        <div className="template-form">
          <input
            className="ob-input"
            placeholder="Название шаблона"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            className="ob-input"
            placeholder="Текст поздравления... Используй {name} для имени."
            rows={4}
            value={body}
            onChange={e => setBody(e.target.value)}
          />
          <div className="ai-toggle-row">
            <span>Подставлять имя {'{name}'}</span>
            <label className="toggle">
              <input type="checkbox" checked={useName} onChange={e => setUseName(e.target.checked)} />
              <span className="slider" />
            </label>
          </div>
          <div className="template-form-actions">
            <button className="btn-ghost" onClick={() => setCreating(false)}>Отмена</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Сохраняю...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      {userTemplates.length > 0 && (
        <>
          <div className="section-label">Мои шаблоны</div>
          <div className="template-list">
            {userTemplates.map(t => (
              <div key={t.id} className="template-card">
                <div className="template-info">
                  <div className="template-title">{t.title}</div>
                  <div className="template-body">{t.body}</div>
                  {t.use_name ? <span className="badge-name">с именем</span> : null}
                </div>
                <button className="btn-delete" onClick={() => handleDelete(t.id)}>🗑</button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-label">Системные шаблоны</div>
      <div className="template-list">
        {systemTemplates.map(t => (
          <div key={t.id} className="template-card template-card--system">
            <div className="template-info">
              <div className="template-title">{t.title}</div>
              <div className="template-body">{t.body}</div>
            </div>
            <span className="badge-system">системный</span>
          </div>
        ))}
      </div>
    </div>
  );
}
