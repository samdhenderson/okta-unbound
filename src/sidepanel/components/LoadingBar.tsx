// Note: This file intentionally sets state in effects to manage elapsed time display.
// The pattern is safe and intentional for this timer component.

import React, { useState, useEffect, useCallback } from 'react';
import { useProgress } from '../contexts/ProgressContext';

const LoadingBar: React.FC = () => {
  const { progress } = useProgress();
  const [elapsedTime, setElapsedTime] = useState(0);

  // Memoized function to update elapsed time
  const updateElapsed = useCallback(() => {
    if (progress.startTime) {
      setElapsedTime(Math.floor((Date.now() - progress.startTime) / 1000));
    }
  }, [progress.startTime]);

  // Update elapsed time every second when loading
  useEffect(() => {
    if (!progress.isLoading || !progress.startTime) {
      return;
    }

    // Calculate initial elapsed time
    updateElapsed();

    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [progress.isLoading, progress.startTime, updateElapsed]);

  // Reset elapsed time when loading stops
  useEffect(() => {
    if (!progress.isLoading) {
      setElapsedTime(0);
    }
  }, [progress.isLoading]);

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
    <div
      className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-white via-gray-50 to-white border-t border-gray-200/80 shadow-lg backdrop-blur-sm animate-in slide-in-from-bottom-3 duration-300"
      style={{ zIndex: 1000, fontFamily: 'var(--font-primary)' }}
    >
      <div className="px-6 py-4 space-y-3">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Animated spinner */}
            <div className="relative">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-[#007dc1] rounded-full animate-spin" />
              <div className="absolute inset-0 w-5 h-5 border-2 border-transparent border-t-[#3d9dd9] rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>
            {progress.operationName && (
              <span className="text-sm font-bold text-gray-900">{progress.operationName}</span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs">
            {progress.apiCalls !== undefined && progress.apiCalls > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200/60 rounded-md" title="API requests made">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-blue-600">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                <span className="font-semibold text-blue-700">{progress.apiCalls}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-200/60 rounded-md font-mono" title="Elapsed time">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-gray-600">
                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
              </svg>
              <span className="font-semibold text-gray-700">{formatTime(elapsedTime)}</span>
            </div>
            {remainingTime > 0 && progress.current > 2 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200/60 rounded-md font-mono" title="Estimated remaining">
                <span className="text-amber-700 font-semibold">~{formatTime(remainingTime)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress Message and Count */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-700 font-medium">{progress.message}</span>
          <span className="font-semibold text-gray-900 font-mono">
            {progress.current} / {progress.total}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <div className="h-2 bg-gray-200/60 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-[#007dc1] via-[#3d9dd9] to-[#007dc1] rounded-full transition-all duration-300 ease-out relative overflow-hidden"
              style={{ width: `${percentage}%` }}
            >
              {/* Animated shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>
          {/* Percentage Badge */}
          <div className="absolute -top-1 right-0 -translate-y-full mb-1">
            <div className="px-2 py-0.5 bg-[#007dc1] text-white text-xs font-bold rounded shadow-sm">
              {Math.round(percentage)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingBar;
