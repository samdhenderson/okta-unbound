/**
 * @module sidepanel/hooks/useActivityBar
 * @description Merges scheduler state and operation progress into one display model
 * for the unified {@link ActivityBarView}, and owns the single Cancel path.
 *
 * The side panel previously showed two independent fixed bars (scheduler status and
 * operation progress) that overlapped and reflowed. This hook is the join point:
 * it reads {@link useScheduler} + {@link useProgress}, derives every field the bar
 * renders (including live elapsed/ETA and cooldown countdowns via internal timers),
 * and exposes a `cancel` that stops the whole operation AND drains the queue.
 */
import { useState, useEffect, useCallback } from 'react';
import { useScheduler } from '../contexts/SchedulerContext';
import { useProgress } from '../contexts/ProgressContext';
import type { SchedulerStatus } from '../../shared/scheduler/types';

/** Display-ready, already-merged activity state consumed by `ActivityBarView`. */
export interface ActivityView {
  /** Human label for the current status (operation-aware). */
  statusLabel: string;
  /** CSS custom-property expression for the status dot colour (a design token). */
  statusColorVar: string;
  /** Whether to animate the status dot (anything other than fully idle). */
  busy: boolean;
  /** Whether a named operation is currently running. */
  operationActive: boolean;
  /** Name of the running operation, if any. */
  operationName?: string;
  /** Current step message, if any. */
  message?: string;
  /** Items processed so far in the current operation. */
  current: number;
  /** Total items in the current operation. */
  total: number;
  /** Progress percentage (0–100). */
  percentage: number;
  /** Elapsed wall-clock label, e.g. `0:12`. */
  elapsedLabel?: string;
  /** Estimated-remaining label, e.g. `~0:48 left`. */
  etaLabel?: string;
  /** API calls made during the current operation. */
  apiCalls?: number;
  /** Queued (not yet dispatched) requests. */
  queueLength: number;
  /** In-flight requests. */
  activeRequests: number;
  /** Rate-limit headroom, or `null` when unknown. `low` marks ≤20% remaining. */
  rateLimit: { remaining: number; limit: number; low: boolean } | null;
  /** Cooldown countdown label, e.g. `12s`, when the scheduler is cooling down. */
  cooldownLabel?: string;
  /** Total requests processed (success + failed) by the scheduler. */
  processed: number;
  /** Failed requests. */
  failed: number;
  /** True while a cancel is unwinding. */
  isCancelling: boolean;
  /** Whether there is anything to cancel (active operation or non-empty queue). */
  canCancel: boolean;
}

/** Value returned by {@link useActivityBar}. */
export interface UseActivityBar {
  /** Merged, display-ready state for the bar. */
  view: ActivityView;
  /** Stop the current operation and drain the scheduler queue. */
  cancel: () => void;
}

const STATUS_COLOR: Record<SchedulerStatus, string> = {
  idle: 'var(--color-success)',
  processing: 'var(--color-info)',
  throttled: 'var(--color-warning)',
  cooldown: 'var(--color-danger)',
  paused: 'var(--color-neutral-500)',
};

const STATUS_LABEL: Record<SchedulerStatus, string> = {
  idle: 'Ready',
  processing: 'Processing',
  throttled: 'Throttled',
  cooldown: 'Cooldown',
  paused: 'Paused',
};

/** Format seconds as `m:ss`. */
function clock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Format milliseconds as a coarse `Xm Ys` / `Xs` cooldown label. */
function cooldownClock(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds >= 60) {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Merge scheduler + progress state into the {@link ActivityView} and expose the
 * unified cancel.
 *
 * @returns The merged {@link ActivityView} and a `cancel` that both trips the
 * operation cancellation token and clears the background queue.
 */
export function useActivityBar(): UseActivityBar {
  const { state, metrics, clearQueue } = useScheduler();
  const { progress, cancel: cancelOperation } = useProgress();

  // A single ticking clock. Elapsed and cooldown are derived purely from `now`
  // in the memo below, so the effect never calls setState directly (which the
  // React Compiler would otherwise refuse to memoize around).
  const [now, setNow] = useState(() => Date.now());
  const cooldownEndsAt = state?.cooldownEndsAt ?? null;
  const ticking = (progress.isLoading && Boolean(progress.startTime)) || cooldownEndsAt !== null;

  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [ticking]);

  const elapsed =
    progress.isLoading && progress.startTime
      ? Math.max(0, Math.floor((now - progress.startTime) / 1000))
      : 0;
  const cooldownRemaining = cooldownEndsAt ? Math.max(0, cooldownEndsAt - now) : 0;

  const cancel = useCallback(() => {
    // Whole-operation cancel: stop the driving loop, then drain the queue so the
    // "next action" can't start up behind it.
    cancelOperation();
    void clearQueue();
  }, [cancelOperation, clearQueue]);

  // Computed plainly rather than via useMemo: this bar re-renders on every clock
  // tick anyway, and `progress.current` trips the React Compiler's ref-access
  // heuristic when placed in a manual dependency array.
  const status: SchedulerStatus = state?.status ?? 'idle';
  const operationActive = progress.isLoading;
  const done = progress.current;

  const percentage = progress.total > 0 ? Math.min((done / progress.total) * 100, 100) : 0;

  const estimatedTotal = done > 0 ? Math.round((elapsed / done) * progress.total) : 0;
  const remaining = Math.max(0, estimatedTotal - elapsed);
  const etaLabel =
    operationActive && remaining > 0 && done > 2 ? `~${clock(remaining)} left` : undefined;

  const rl = state?.rateLimitInfo ?? null;
  const rateLimit = rl
    ? { remaining: rl.remaining, limit: rl.limit, low: (rl.remaining / rl.limit) * 100 <= 20 }
    : null;

  const queueLength = state?.queueLength ?? 0;

  const view: ActivityView = {
    statusLabel: STATUS_LABEL[status],
    statusColorVar: STATUS_COLOR[status],
    busy: status !== 'idle' || operationActive,
    operationActive,
    operationName: progress.operationName,
    message: progress.message,
    current: done,
    total: progress.total,
    percentage,
    elapsedLabel: operationActive ? clock(elapsed) : undefined,
    etaLabel,
    apiCalls: progress.apiCalls,
    queueLength,
    activeRequests: state?.activeRequests ?? 0,
    rateLimit,
    cooldownLabel:
      status === 'cooldown' && cooldownRemaining > 0 ? cooldownClock(cooldownRemaining) : undefined,
    processed: state?.totalProcessed ?? 0,
    failed: metrics?.failedRequests ?? 0,
    isCancelling: Boolean(progress.isCancelling),
    canCancel: (operationActive || queueLength > 0) && !progress.isCancelling,
  };

  return { view, cancel };
}
