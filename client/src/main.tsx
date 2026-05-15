import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './App.css';

// Инициализация Telegram Mini App
const twa = (window as any).Telegram?.WebApp;
if (twa) {
  twa.ready();
  twa.expand(); // Разворачиваем на весь экран
  twa.setHeaderColor('#FFF8F0');
  twa.setBackgroundColor('#FFF8F0');
}

const root = document.getElementById('root')!;
createRoot(root).render(<App />);
