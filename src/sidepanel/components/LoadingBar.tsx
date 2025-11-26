import React, { useState, useEffect } from 'react';
import { useProgress } from '../contexts/ProgressContext';

const LoadingBar: React.FC = () => {
  const { progress } = useProgress();
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time every second
  useEffect(() => {
    if (!progress.isLoading || !progress.startTime) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - progress.startTime!) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [progress.isLoading, progress.startTime]);

  if (!progress.isLoading) {
    return null;
  }

  const percentage = progress.total > 0 ? Math.min((progress.current / progress.total) * 100, 100) : 0;

  // Format elapsed time as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Estimate remaining time
  const estimatedTotal = progress.current > 0
    ? Math.round((elapsedTime / progress.current) * progress.total)
    : 0;
  const remainingTime = Math.max(0, estimatedTotal - elapsedTime);

  return (
    <div className="global-loading-bar">
      <div className="global-progress-header">
        {progress.operationName && (
          <span className="global-operation-name">{progress.operationName}</span>
        )}
        <div className="global-progress-stats">
          {progress.apiCalls !== undefined && progress.apiCalls > 0 && (
            <span className="global-api-calls" title="API requests made">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
              {progress.apiCalls}
            </span>
          )}
          <span className="global-elapsed-time" title="Elapsed time">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
            </svg>
            {formatTime(elapsedTime)}
          </span>
          {remainingTime > 0 && progress.current > 2 && (
            <span className="global-remaining-time" title="Estimated remaining">
              ~{formatTime(remainingTime)}
            </span>
          )}
        </div>
      </div>

      <div className="global-progress-info">
        <span className="global-progress-message">{progress.message}</span>
        <span className="global-progress-count">
          {progress.current} / {progress.total}
        </span>
      </div>

      <div className="global-progress-bar-container">
        <div
          className="global-progress-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="global-progress-percentage">
        {Math.round(percentage)}%
      </div>
    </div>
  );
};

export default LoadingBar;
