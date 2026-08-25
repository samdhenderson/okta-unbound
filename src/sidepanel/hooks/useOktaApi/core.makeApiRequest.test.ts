/**
 * Tests for the transient-port retry on coreApi.makeApiRequest.
 *
 * The MV3 service worker suspends when idle, so a side-panel
 * `chrome.runtime.sendMessage({ action: 'scheduleApiRequest' })` that races the
 * suspension rejects with a dropped message port ("message port closed", or
 * "Receiving end does not exist" before wakeup completes). Nothing used to retry
 * that, which surfaced as an intermittent "Failed to fetch rules".
 *
 * These pin the recovery contract: bounded retries for GET only, no retry for a
 * write (a port error is ambiguous about whether the scheduled request already
 * ran), and no retry for a non-transient failure such as a reloaded extension.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createCoreApi, isTransientPortError } from './core';

const runtimeSendMessage = chrome.runtime.sendMessage as ReturnType<typeof vi.fn>;

const PORT_CLOSED = 'The message port closed before a response was received.';
const NO_RECEIVER = 'Could not establish connection. Receiving end does not exist.';
const CONTEXT_INVALIDATED = 'Extension context invalidated.';

/** Build a coreApi bound to a tab with no-op progress/cancellation hooks. */
function makeCore() {
  const progress = { start: vi.fn(), reportBatch: vi.fn(), complete: vi.fn() };
  return createCoreApi(1, () => {}, vi.fn(), progress, {});
}

/** Count of scheduled requests actually put on the wire. */
function scheduleCallCount(): number {
  return runtimeSendMessage.mock.calls.filter((c) => c[0]?.action === 'scheduleApiRequest').length;
}

beforeEach(() => {
  runtimeSendMessage.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('isTransientPortError', () => {
  it.each([
    PORT_CLOSED,
    NO_RECEIVER,
    'the message port closed before a response was received',
    'RECEIVING END DOES NOT EXIST',
  ])('matches the transient service-worker wakeup failure: %s', (message) => {
    expect(isTransientPortError(message)).toBe(true);
  });

  it.each([
    CONTEXT_INVALIDATED,
    'Failed to fetch',
    'No target tab ID - not connected to Okta page',
    '',
  ])('does not match the non-recoverable failure: %s', (message) => {
    expect(isTransientPortError(message)).toBe(false);
  });
});

describe('coreApi.makeApiRequest transient-port retry', () => {
  it('retries a GET once after a dropped port and resolves', async () => {
    runtimeSendMessage
      .mockRejectedValueOnce(new Error(PORT_CLOSED))
      .mockResolvedValueOnce({ success: true, data: { id: '00gFAKEGROUP' } });

    const promise = makeCore().makeApiRequest('/api/v1/groups/00gFAKEGROUP/rules', {
      reason: 'Load group rules',
    });
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ success: true, data: { id: '00gFAKEGROUP' } });
    expect(scheduleCallCount()).toBe(2);
  });

  it('gives up after two retries and propagates the error', async () => {
    runtimeSendMessage.mockRejectedValue(new Error(PORT_CLOSED));

    const promise = makeCore().makeApiRequest('/api/v1/groups', { reason: 'Load groups' });
    const assertion = expect(promise).rejects.toThrow(PORT_CLOSED);
    await vi.runAllTimersAsync();
    await assertion;

    // Initial attempt + 2 retries.
    expect(scheduleCallCount()).toBe(3);
  });

  it('never retries a write — a port error is ambiguous about whether it executed', async () => {
    runtimeSendMessage.mockRejectedValue(new Error(PORT_CLOSED));

    const promise = makeCore().makeApiRequest('/api/v1/groups/00gFAKEGROUP/users/00uFAKEUSER', {
      method: 'PUT',
      reason: 'Add user to group',
    });
    const assertion = expect(promise).rejects.toThrow(PORT_CLOSED);
    await vi.runAllTimersAsync();
    await assertion;

    expect(scheduleCallCount()).toBe(1);
  });

  it('does not retry a reloaded extension — the error surfaces immediately', async () => {
    runtimeSendMessage.mockRejectedValue(new Error(CONTEXT_INVALIDATED));

    const promise = makeCore().makeApiRequest('/api/v1/groups', { reason: 'Load groups' });
    const assertion = expect(promise).rejects.toThrow(CONTEXT_INVALIDATED);
    await vi.runAllTimersAsync();
    await assertion;

    expect(scheduleCallCount()).toBe(1);
  });
});
