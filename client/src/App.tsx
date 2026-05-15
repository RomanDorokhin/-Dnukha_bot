import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import AddBirthday from './components/AddBirthday';
import Settings from './components/Settings';
import './App.css';

type Screen = 'dashboard' | 'add' | 'settings';

export default function App() {
  const [screen, setScreen] = useState<Screen>('dashboard');

  return (
    <div className="app">
      {screen === 'dashboard' && (
        <Dashboard
          onAdd={() => setScreen('add')}
          onSettings={() => setScreen('settings')}
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
    </div>
  );
}
