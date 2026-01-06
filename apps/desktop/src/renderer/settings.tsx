import React from 'react';
import ReactDOM from 'react-dom/client';
import { SettingsApp } from './pages/settings/SettingsApp';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsApp />
  </React.StrictMode>
);
