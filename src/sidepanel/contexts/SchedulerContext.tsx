/**
 * @module sidepanel/contexts/SchedulerContext
 * @description React context that mirrors the background {@link SchedulerState} and
 * {@link SchedulerMetrics} into the side panel and exposes pause/resume/clear controls.
 *
 * All state lives in the background `ApiScheduler`; this context is a read-through
 * view of it. State is fetched once on mount and then kept current purely by the
 * `schedulerStateChanged` push messages the background emits on every state
 * transition — there is no polling. (Cooldown countdowns tick locally in
 * `useActivityBar` off the absolute `cooldownEndsAt` timestamp, so no periodic
 * re-fetch is needed for a smooth countdown.) The control methods
 * (`pause`/`resume`/`clearQueue`) round-trip through `chrome.runtime.sendMessage`
 * and re-read state afterwards for immediate feedback.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import type { SchedulerState, SchedulerMetrics } from '../../shared/scheduler/types';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('SchedulerContext');

/**
 * Value exposed by {@link SchedulerContext}: the latest scheduler snapshot plus
 * controls for the background queue.
 */
interface SchedulerContextType {
  /** Latest scheduler state (queue, cooldown, pause flag), or `null` before the first fetch. */
  state: SchedulerState | null;
  /** Latest throughput/rate-limit metrics, or `null` before the first fetch. */
  metrics: SchedulerMetrics | null;
  /** Ask the background scheduler to pause processing, then re-read state. */
  pause: () => Promise<void>;
  /** Ask the background scheduler to resume processing, then re-read state. */
  resume: () => Promise<void>;
  /** Drop all queued requests in the background scheduler, then re-read state. */
  clearQueue: () => Promise<void>;
  /** Force an immediate re-fetch of {@link SchedulerContextType.state}. */
  refreshState: () => Promise<void>;
  /** Force an immediate re-fetch of {@link SchedulerContextType.metrics}. */
  refreshMetrics: () => Promise<void>;
}

const SchedulerContext = createContext<SchedulerContextType | undefined>(undefined);

/**
 * Provides scheduler state and controls to the side panel. Polls the background for
 * state once per second and subscribes to `schedulerStateChanged` push messages so
 * cooldown countdowns and queue depth stay current.
 *
 * @param props.children - Subtree that may call {@link useScheduler}.
 */
export const SchedulerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SchedulerState | null>(null);
  const [metrics, setMetrics] = useState<SchedulerMetrics | null>(null);

  const refreshState = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getSchedulerState',
      });

      if (response.success) {
        setState(response.state);
      }
    } catch (error) {
      log.error('Failed to fetch scheduler state:', error);
    }
  }, []);

  const refreshMetrics = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getSchedulerMetrics',
      });

      if (response.success) {
        setMetrics(response.metrics);
      }
    } catch (error) {
      log.error('Failed to fetch scheduler metrics:', error);
    }
  }, []);

  // Fetch initial state once on mount. Live updates arrive via the
  // `schedulerStateChanged` push listener below — the background scheduler now
  // notifies on every state transition, so there is no polling interval.
  useEffect(() => {
    // Fetch initial data in an async IIFE to avoid setState-in-effect warning
    (async () => {
      await refreshState();
      await refreshMetrics();
    })();
  }, [refreshState, refreshMetrics]);

  // Listen for scheduler state changes from background
  useEffect(() => {
    const listener = (message: { action?: string; state?: SchedulerState }) => {
      if (message.action === 'schedulerStateChanged') {
        setState(message.state ?? null);
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  const pause = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'pauseScheduler' });
      await refreshState();
    } catch (error) {
      log.error('Failed to pause scheduler:', error);
    }
  }, [refreshState]);

  const resume = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'resumeScheduler' });
      await refreshState();
    } catch (error) {
      log.error('Failed to resume scheduler:', error);
    }
  }, [refreshState]);

  const clearQueue = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'clearSchedulerQueue' });
      await refreshState();
    } catch (error) {
      log.error('Failed to clear queue:', error);
    }
  }, [refreshState]);

  return (
    <SchedulerContext.Provider
      value={{
        state,
        metrics,
        pause,
        resume,
        clearQueue,
        refreshState,
        refreshMetrics,
      }}
    >
      {children}
    </SchedulerContext.Provider>
  );
};

/**
 * Access the scheduler state and controls.
 *
 * @returns The `SchedulerContextType` value from the nearest {@link SchedulerProvider}.
 * @throws If called outside a {@link SchedulerProvider}.
 */
export const useScheduler = (): SchedulerContextType => {
  const context = useContext(SchedulerContext);
  if (!context) {
    throw new Error('useScheduler must be used within a SchedulerProvider');
  }
  return context;
};
