import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ProgressProvider } from './contexts/ProgressContext';
import './styles.css';

console.log('[Sidepanel] Initializing React app');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ProgressProvider>
      <App />
    </ProgressProvider>
  </React.StrictMode>
);
