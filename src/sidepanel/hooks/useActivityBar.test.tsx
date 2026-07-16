/**
 * Tests for useActivityBar — the join between scheduler state and operation
 * progress, and the single Cancel path.
 *
 * The important guarantee: one Cancel stops BOTH halves of the reported bug — it
 * trips the operation cancellation (so the driving loop stops) and drains the
 * background queue (so the next queued action can't start). It also merges both
 * sources into one display model so the bar can show them together.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { SchedulerProvider } from '../contexts/SchedulerContext';
import { ProgressProvider, useProgress } from '../contexts/ProgressContext';
import { useActivityBar } from './useActivityBar';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ProgressProvider>
    <SchedulerProvider>{children}</SchedulerProvider>
  </ProgressProvider>
);

const sendMessage = chrome.runtime.sendMessage as ReturnType<typeof vi.fn>;

beforeEach(() => {
  sendMessage.mockReset();
  sendMessage.mockImplementation((msg: { action: string }) => {
    if (msg.action === 'getSchedulerState') {
      return Promise.resolve({
        success: true,
        state: {
          status: 'processing',
          queueLength: 6,
          activeRequests: 2,
          totalProcessed: 4,
          rateLimitInfo: { limit: 600, remaining: 550, reset: 0, endpoint: '/x', timestamp: 0 },
          cooldownEndsAt: null,
          errorCount: 0,
          lastError: null,
        },
      });
    }
    if (msg.action === 'getSchedulerMetrics') {
      return Promise.resolve({ success: true, metrics: { failedRequests: 1 } });
    }
    return Promise.resolve({ success: true });
  });
});

describe('useActivityBar', () => {
  it('merges scheduler state into the view', async () => {
    const { result } = renderHook(() => useActivityBar(), { wrapper });

    await waitFor(() => expect(result.current.view.queueLength).toBe(6));
    expect(result.current.view.activeRequests).toBe(2);
    expect(result.current.view.rateLimit).toEqual({ remaining: 550, limit: 600, low: false });
    expect(result.current.view.statusLabel).toBe('Processing');
  });

  it('reflects a running operation from progress', () => {
    const { result } = renderHook(() => ({ bar: useActivityBar(), progress: useProgress() }), {
      wrapper,
    });

    act(() => result.current.progress.startProgress('Removing users', 'Working…', 10));

    expect(result.current.bar.view.operationActive).toBe(true);
    expect(result.current.bar.view.operationName).toBe('Removing users');
    expect(result.current.bar.view.canCancel).toBe(true);
  });

  it('surfaces the operation breakdown from updateBatch', () => {
    const { result } = renderHook(() => ({ bar: useActivityBar(), progress: useProgress() }), {
      wrapper,
    });

    act(() => result.current.progress.startProgress('Removing users', 'Working…', 30));
    act(() =>
      result.current.progress.updateBatch({ total: 30, completed: 18, active: 5, failed: 2 }),
    );

    expect(result.current.bar.view.total).toBe(30);
    expect(result.current.bar.view.opCompleted).toBe(18);
    expect(result.current.bar.view.opActive).toBe(5);
    expect(result.current.bar.view.opFailed).toBe(2);
    expect(result.current.bar.view.current).toBe(20); // completed + failed
  });

  it('cancel() drains the queue AND cancels the operation', async () => {
    const { result } = renderHook(() => ({ bar: useActivityBar(), progress: useProgress() }), {
      wrapper,
    });

    act(() => result.current.progress.startProgress('Removing users', 'Working…', 10));
    act(() => result.current.bar.cancel());

    // Queue half: background scheduler asked to clear.
    expect(sendMessage).toHaveBeenCalledWith({ action: 'clearSchedulerQueue' });
    // Operation half: cancellation tripped, reflected as isCancelling.
    expect(result.current.progress.progress.isCancelling).toBe(true);
    expect(result.current.progress.isCancelled).toBe(true);
  });
});
