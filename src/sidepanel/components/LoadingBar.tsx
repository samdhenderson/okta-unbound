import React from 'react';
import { useProgress } from '../contexts/ProgressContext';

const LoadingBar: React.FC = () => {
  const { progress } = useProgress();

  if (!progress.isLoading) {
    return null;
  }

  const percentage = progress.total > 0 ? Math.min((progress.current / progress.total) * 100, 100) : 0;

  return (
    <div className="global-loading-bar">
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
    </div>
  );
};

export default LoadingBar;
