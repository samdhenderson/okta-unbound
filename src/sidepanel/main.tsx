import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { ProgressProvider } from './contexts/ProgressContext';
import { createLogger } from '../shared/utils/logger';
import './tailwind.css';

const log = createLogger('Sidepanel');

log.debug('Initializing React app');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ProgressProvider>
        <App />
      </ProgressProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
