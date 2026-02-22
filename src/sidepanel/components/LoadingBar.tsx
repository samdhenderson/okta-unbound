import React, { useState, useEffect, useCallback } from 'react';
import { useProgress } from '../contexts/ProgressContext';

const LoadingBar: React.FC = () => {
  const { progress } = useProgress();
  const [elapsedTime, setElapsedTime] = useState(0);

  const updateElapsed = useCallback(() => {
    if (progress.startTime) {
      setElapsedTime(Math.floor((Date.now() - progress.startTime) / 1000));
    }
  }, [progress.startTime]);

  useEffect(() => {
    if (!progress.isLoading || !progress.startTime) return;
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [progress.isLoading, progress.startTime, updateElapsed]);

  useEffect(() => {
    if (!progress.isLoading) setElapsedTime(0);
  }, [progress.isLoading]);

  if (!progress.isLoading) return null;

  const percentage = progress.total > 0 ? Math.min((progress.current / progress.total) * 100, 100) : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const estimatedTotal = progress.current > 0
    ? Math.round((elapsedTime / progress.current) * progress.total)
    : 0;
  const remainingTime = Math.max(0, estimatedTotal - elapsedTime);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 shadow-lg z-50">
      <div className="px-5 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-neutral-200 border-t-primary rounded-full animate-spin" />
            {progress.operationName && (
              <span className="text-sm font-medium text-neutral-900">{progress.operationName}</span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-neutral-500">
            {progress.apiCalls !== undefined && progress.apiCalls > 0 && (
              <span>{progress.apiCalls} API calls</span>
            )}
            <span className="font-mono">{formatTime(elapsedTime)}</span>
            {remainingTime > 0 && progress.current > 2 && (
              <span className="text-warning-text font-mono">~{formatTime(remainingTime)} left</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-600">
          <span>{progress.message}</span>
          <span className="font-medium">{progress.current} / {progress.total}</span>
        </div>

        <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-100"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default LoadingBar;
