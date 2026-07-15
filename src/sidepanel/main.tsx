/**
 * @module sidepanel/main
 * @description Side-panel entry point: mounts the React tree into `#root`.
 *
 * Wraps {@link App} in `StrictMode`, the top-level {@link ErrorBoundary}, and the
 * `ProgressProvider` so progress state and error fallback are available app-wide.
 */
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
