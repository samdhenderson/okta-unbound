/**
 * Tests for ApiScheduler state-change notifications.
 *
 * The side panel's `SchedulerContext` is a push-only read-through view (no
 * polling), so the scheduler must notify on EVERY real status transition —
 * including the transition back to `idle` when the queue drains, which happens
 * inside the 50ms processing loop and used to be masked by the context's 1s poll.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiScheduler } from './apiScheduler';
import type { SchedulerState, SchedulerStatus } from './types';

let scheduler: ApiScheduler;
const sendMessage = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (chrome as unknown as { tabs: { sendMessage: typeof sendMessage } }).tabs = {
    sendMessage,
  };
});

afterEach(() => {
  scheduler?.stop();
});

describe('ApiScheduler state-change notifications', () => {
  it('notifies with status "idle" once the queue drains (the transition the old poll masked)', async () => {
    sendMessage.mockResolvedValue({ success: true, data: 'ok' });
    scheduler = new ApiScheduler();

    const seen: SchedulerStatus[] = [];
    scheduler.onStateChange((s: SchedulerState) => seen.push(s.status));

    // Resolves when the request completes; status is still 'processing' here
    // (the idle transition happens on the next 50ms processing-loop tick).
    await scheduler.scheduleRequest('/api/v1/users/me', 'GET', undefined, 1);
    expect(seen).toContain('processing');

    // The processing -> idle transition after the queue empties must be PUSHED,
    // not left for a poll to discover: the last notification is the idle one.
    await vi.waitFor(() => expect(scheduler.getState().status).toBe('idle'));
    expect(seen.at(-1)).toBe('idle');
  });

  it('does not re-notify while the status is unchanged (the 50ms loop must not churn)', async () => {
    sendMessage.mockResolvedValue({ success: true, data: 'ok' });
    scheduler = new ApiScheduler();

    await scheduler.scheduleRequest('/api/v1/users/me', 'GET', undefined, 1);
    await vi.waitFor(() => expect(scheduler.getState().status).toBe('idle'));

    // Subscribe once the scheduler is sitting idle: the perpetual 50ms loop keeps
    // calling updateStatus('idle'), but the `!==` guard means no notifications fire.
    const listener = vi.fn();
    scheduler.onStateChange(listener);
    await new Promise((r) => setTimeout(r, 200));
    expect(listener).not.toHaveBeenCalled();
  });
});
