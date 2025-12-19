/**
 * Scheduler Status Bar
 *
 * Displays the global API scheduler status in a compact bar.
 * Shows:
 * - Current status (idle, processing, throttled, cooldown, paused)
 * - Queue length
 * - Active requests
 * - Rate limit information
 * - Cooldown countdown
 */

import React, { useState, useEffect } from 'react';
import { useScheduler } from '../contexts/SchedulerContext';

const SchedulerStatusBar: React.FC = () => {
  const { state, metrics, clearQueue } = useScheduler();
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // Update cooldown countdown
  useEffect(() => {
    const updateCountdown = () => {
      if (!state?.cooldownEndsAt) {
        setCooldownRemaining(0);
        return;
      }
      const remaining = Math.max(0, state.cooldownEndsAt - Date.now());
      setCooldownRemaining(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);

    return () => clearInterval(interval);
  }, [state?.cooldownEndsAt]);

  if (!state) return null;

  // Don't show when idle and nothing in queue
  if (state.status === 'idle' && state.queueLength === 0 && state.activeRequests === 0) {
    return null;
  }

  const getStatusColor = (): string => {
    switch (state.status) {
      case 'idle':
        return '#4caf50'; // Green
      case 'processing':
        return '#2196f3'; // Blue
      case 'throttled':
        return '#ff9800'; // Orange
      case 'cooldown':
        return '#f44336'; // Red
      case 'paused':
        return '#9e9e9e'; // Gray
      default:
        return '#666';
    }
  };

  const getStatusLabel = (): string => {
    switch (state.status) {
      case 'idle':
        return 'Idle';
      case 'processing':
        return 'Processing';
      case 'throttled':
        return 'Throttled';
      case 'cooldown':
        return 'Cooldown';
      case 'paused':
        return 'Paused';
      default:
        return 'Unknown';
    }
  };

  const formatCooldownTime = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    if (seconds >= 60) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-white via-gray-50 to-white border-t border-gray-200/80 shadow-lg backdrop-blur-sm animate-in slide-in-from-bottom-2 duration-300"
      style={{ zIndex: 999, fontFamily: 'var(--font-primary)' }}
    >
      <div className="px-6 py-3 flex items-center gap-4 text-xs">
        {/* Status indicator with dot */}
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full shadow-sm animate-pulse"
            style={{ backgroundColor: getStatusColor() }}
          />
          <span className="font-bold text-gray-900">{getStatusLabel()}</span>
        </div>

        {/* Queue info */}
        {state.queueLength > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200/60 rounded-md">
            <span className="text-gray-600">Queue:</span>
            <span className="font-bold text-blue-700">{state.queueLength}</span>
          </div>
        )}

        {/* Active requests */}
        {state.activeRequests > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200/60 rounded-md">
            <span className="text-gray-600">Active:</span>
            <span className="font-bold text-emerald-700">{state.activeRequests}</span>
          </div>
        )}

        {/* Rate limit info */}
        {state.rateLimitInfo && (
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
              (state.rateLimitInfo.remaining / state.rateLimitInfo.limit) * 100 <= 20
                ? 'bg-red-50 border-red-200/60'
                : 'bg-gray-50 border-gray-200/60'
            }`}
          >
            <span className="text-gray-600">Rate Limit:</span>
            <span
              className={`font-bold ${
                (state.rateLimitInfo.remaining / state.rateLimitInfo.limit) * 100 <= 20
                  ? 'text-red-700'
                  : 'text-gray-900'
              }`}
            >
              {state.rateLimitInfo.remaining}/{state.rateLimitInfo.limit}
            </span>
          </div>
        )}

        {/* Cooldown countdown */}
        {state.status === 'cooldown' && cooldownRemaining > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 border border-red-200/60 rounded-md">
            <span className="text-red-700 font-semibold">Resuming in:</span>
            <span className="font-bold text-red-900 font-mono">{formatCooldownTime(cooldownRemaining)}</span>
          </div>
        )}

        {/* Total processed */}
        {metrics && state.totalProcessed > 0 && (
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-200/60 rounded-md">
            <span className="text-gray-600">Processed:</span>
            <span className="font-bold text-gray-900">{state.totalProcessed}</span>
            {metrics.failedRequests > 0 && (
              <span className="font-semibold text-red-700">({metrics.failedRequests} failed)</span>
            )}
          </div>
        )}

        {/* Cancel/Clear Queue Button */}
        {state.queueLength > 0 && (
          <button
            onClick={async () => {
              if (confirm(`Cancel ${state.queueLength} pending API requests?`)) {
                await clearQueue();
              }
            }}
            className="px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-xs font-bold rounded-md transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 flex items-center gap-1.5"
            title="Cancel all pending requests"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Cancel</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default SchedulerStatusBar;
