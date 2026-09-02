/**
 * Regression test for the cache-hit loading lifecycle in useUserMemberships.
 *
 * A caller (the Users tab's detected-user / "View all groups" load) flips the
 * loading flag on *before* invoking loadMemberships. When the analysis is already
 * cached, loadMemberships returns early — and it must still clear the loading flag,
 * otherwise the caller's spinner stays stuck on forever ("loads forever, nothing
 * populates"). This pins that the early return reports loading:false.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUserMemberships } from './useUserMemberships';
import { setEntry, resetEntityCache } from '../cache/entityCache';
import type { OktaUser } from '../../shared/types';

// D-051: the load's catch must log a narrowed string, never the raw caught
// error object — logger.ts's `error` level always emits, including in
// production, so a future throw site's payload/PII would otherwise ship.
vi.mock('./getUserGroupsRequest', () => ({
  getUserGroupsRequest: vi.fn().mockRejectedValue(new Error('boundary validation failed')),
}));
const { logError } = vi.hoisted(() => ({ logError: vi.fn() }));
vi.mock('../../shared/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: logError }),
}));

// A tab id is required, but the cache-hit path never touches chrome — provide a
// stub so an accidental network call would be observable (asserted below).
const tabsSendMessage = vi.fn();
globalThis.chrome = {
  tabs: { sendMessage: tabsSendMessage },
} as unknown as typeof chrome;

const user = { id: 'u1' } as OktaUser;

beforeEach(() => {
  vi.clearAllMocks();
  resetEntityCache();
});

describe('useUserMemberships cache-hit loading lifecycle', () => {
  it('clears the loading flag when serving a cached analysis', async () => {
    // Prime the cache so loadMemberships takes the early-return path.
    setEntry(['userMemberships', user.id], []);

    const onLoadingChange = vi.fn();
    const { result } = renderHook(() => useUserMemberships({ targetTabId: 1, onLoadingChange }));

    await act(async () => {
      await result.current.loadMemberships(user);
    });

    // The cache hit must report loading:false (the bug left it uncalled, so an
    // externally-set spinner never cleared) and must not hit the content script.
    expect(onLoadingChange).toHaveBeenCalledWith(false);
    expect(tabsSendMessage).not.toHaveBeenCalled();
  });
});

describe('useUserMemberships load failure logging (D-051)', () => {
  it('logs a narrowed message, never the raw caught error object', async () => {
    const { result } = renderHook(() => useUserMemberships({ targetTabId: 1 }));

    await act(async () => {
      await result.current.loadMemberships(user);
    });

    expect(logError).toHaveBeenCalledWith(
      'Membership loading error:',
      'boundary validation failed',
    );
    // Never the raw Error instance, and never anything by reference — only a string.
    for (const call of logError.mock.calls) {
      for (const arg of call) {
        expect(arg).not.toBeInstanceOf(Error);
      }
    }
  });
});
