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
  const { state, metrics } = useScheduler();
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // Update cooldown countdown
  useEffect(() => {
    if (!state?.cooldownEndsAt) {
      setCooldownRemaining(0);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, state.cooldownEndsAt! - Date.now());
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
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
        padding: '8px 16px',
        fontSize: '12px',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}
    >
      {/* Status indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(),
          }}
        />
        <span style={{ fontWeight: 600 }}>{getStatusLabel()}</span>
      </div>

      {/* Queue info */}
      {state.queueLength > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Queue:</span>
          <span style={{ fontWeight: 600 }}>{state.queueLength}</span>
        </div>
      )}

      {/* Active requests */}
      {state.activeRequests > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Active:</span>
          <span style={{ fontWeight: 600 }}>{state.activeRequests}</span>
        </div>
      )}

      {/* Rate limit info */}
      {state.rateLimitInfo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Rate Limit:</span>
          <span
            style={{
              fontWeight: 600,
              color:
                (state.rateLimitInfo.remaining / state.rateLimitInfo.limit) * 100 <= 20
                  ? '#f44336'
                  : 'inherit',
            }}
          >
            {state.rateLimitInfo.remaining}/{state.rateLimitInfo.limit}
          </span>
        </div>
      )}

      {/* Cooldown countdown */}
      {state.status === 'cooldown' && cooldownRemaining > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: '#f44336',
            fontWeight: 600,
          }}
        >
          <span>Resuming in:</span>
          <span>{formatCooldownTime(cooldownRemaining)}</span>
        </div>
      )}

      {/* Total processed */}
      {metrics && state.totalProcessed > 0 && (
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--text-secondary)',
          }}
        >
          <span>Processed:</span>
          <span>{state.totalProcessed}</span>
          {metrics.failedRequests > 0 && (
            <span style={{ color: '#f44336' }}>({metrics.failedRequests} failed)</span>
          )}
        </div>
      )}
    </div>
  );
};

export default SchedulerStatusBar;
