/**
 * @module sidepanel/components/SchedulerStatusBar
 * @description Fixed bottom bar reporting the global API scheduler's live state.
 *
 * Subscribes to the SchedulerContext and shows the current status (idle /
 * processing / throttled / cooldown / paused), queue length, active requests,
 * rate-limit headroom, a live cooldown countdown, total processed/failed counts,
 * and a confirm-gated "Cancel" action to clear the pending queue.
 */
import React, { useState, useEffect } from 'react';
import { Button } from './shared';
import { useScheduler } from '../contexts/SchedulerContext';

/**
 * Renders the scheduler status bar from SchedulerContext state, or nothing until
 * the scheduler state is available.
 */
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

  const getStatusColor = (): string => {
    switch (state.status) {
      case 'idle':
        return 'var(--color-success)'; // ready/idle
      case 'processing':
        return 'var(--color-info)';
      case 'throttled':
        return 'var(--color-warning)';
      case 'cooldown':
        return 'var(--color-danger)';
      case 'paused':
        return 'var(--color-neutral-500)';
      default:
        return 'var(--color-neutral-600)';
    }
  };

  const getStatusLabel = (): string => {
    switch (state.status) {
      case 'idle':
        return 'Ready';
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
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 backdrop-blur-sm animate-in slide-in-from-bottom-2 duration-100"
      style={{ zIndex: 999, fontFamily: 'var(--font-primary)' }}
    >
      <div className="px-6 py-3 flex items-center gap-4 text-xs">
        {/* Status indicator with dot */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full shadow-sm ${state.status !== 'idle' ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: getStatusColor() }}
          />
          <span className="font-bold text-neutral-900">{getStatusLabel()}</span>
        </div>

        {/* Queue info */}
        {state.queueLength > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200/60 rounded-md">
            <span className="text-neutral-600">Queue:</span>
            <span className="font-bold text-blue-700">{state.queueLength}</span>
          </div>
        )}

        {/* Active requests */}
        {state.activeRequests > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-success-light border border-success/20 rounded-md">
            <span className="text-neutral-600">Active:</span>
            <span className="font-bold text-success-text">{state.activeRequests}</span>
          </div>
        )}

        {/* Rate limit info */}
        {state.rateLimitInfo && (
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
              (state.rateLimitInfo.remaining / state.rateLimitInfo.limit) * 100 <= 20
                ? 'bg-danger-light border-danger/20'
                : 'bg-neutral-50 border-neutral-200'
            }`}
          >
            <span className="text-neutral-600">Rate Limit:</span>
            <span
              className={`font-bold ${
                (state.rateLimitInfo.remaining / state.rateLimitInfo.limit) * 100 <= 20
                  ? 'text-danger-text'
                  : 'text-neutral-900'
              }`}
            >
              {state.rateLimitInfo.remaining}/{state.rateLimitInfo.limit}
            </span>
          </div>
        )}

        {/* Cooldown countdown */}
        {state.status === 'cooldown' && cooldownRemaining > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-danger-light border border-danger/20 rounded-md">
            <span className="text-danger-text font-semibold">Resuming in:</span>
            <span className="font-bold text-danger font-mono">
              {formatCooldownTime(cooldownRemaining)}
            </span>
          </div>
        )}

        {/* Total processed */}
        {metrics && state.totalProcessed > 0 && (
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-md">
            <span className="text-neutral-600">Processed:</span>
            <span className="font-bold text-neutral-900">{state.totalProcessed}</span>
            {metrics.failedRequests > 0 && (
              <span className="font-semibold text-danger-text">
                ({metrics.failedRequests} failed)
              </span>
            )}
          </div>
        )}

        {/* Cancel/Clear Queue Button */}
        {state.queueLength > 0 && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (confirm(`Cancel ${state.queueLength} pending API requests?`)) {
                void clearQueue();
              }
            }}
            title="Cancel all pending requests"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            <span>Cancel</span>
          </Button>
        )}
      </div>
    </div>
  );
};

export default SchedulerStatusBar;
