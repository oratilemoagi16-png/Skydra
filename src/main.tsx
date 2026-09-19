import React from 'react';
import ReactDOM from 'react-dom/client';
import { isWebMode } from '@/lib/api';
import App from './App';
// Self-hosted fonts (CSP: no external font CDNs). All unicode subsets included;
// the browser fetches only the ranges actually rendered.
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import '@fontsource/geist/700.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import '@fontsource/geist-mono/600.css';
import './index.css';
import './styles/mobile.css';
import './i18n';

// Attach Tauri console logger only in Tauri mode
if (!isWebMode()) {
  import('@tauri-apps/plugin-log')
    .then(({ attachConsole }) => attachConsole())
    .catch((error) => {
      console.warn('Log plugin unavailable:', error);
    });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
