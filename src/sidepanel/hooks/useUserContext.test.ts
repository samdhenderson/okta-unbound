/**
 * `useUserContext`'s only logic is its `loadEntity`: it asks the content script
 * for the current page's user and reduces the reply to `UserInfo | null`.
 *
 * That reduction is `response.success && response.data ? response.data : null`,
 * and each of its two terms guards against a different bad reply — a probe that
 * failed but still carried a payload, and a probe that succeeded with nothing in
 * it. Both would otherwise be rendered as if they were a detected user. Every
 * branch of that expression gets a case here.
 *
 * The surrounding engine (`useOktaTabContext`) is exercised for real — chrome.*
 * is stubbed at the tab boundary, exactly as `useOktaTabContext.test.tsx` does —
 * because the reduction is only meaningful in terms of what `userInfo` ends up
 * being. Fake org/user placeholders only, per CLAUDE.md.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUserContext } from './useUserContext';

type SendResponse = { success: boolean; data?: unknown };

/** Obviously fake org, on a real Okta domain so `isOktaUrl` accepts the tab. */
const FAKE_ORIGIN = 'https://fake-org.okta.com';
const FAKE_TAB = { id: 42, url: `${FAKE_ORIGIN}/admin/user/profile/view/00uFAKE1`, active: true };

/** Wire chrome.* for a single active Okta tab with a per-action responder. */
function mockOktaTab(responder: (action: string) => SendResponse) {
  (chrome as unknown as { windows: unknown }).windows = {
    getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
  };
  chrome.tabs.query = vi.fn().mockResolvedValue([FAKE_TAB]);
  chrome.tabs.sendMessage = vi
    .fn()
    .mockImplementation((_tabId: number, msg: { action: string }) =>
      Promise.resolve(responder(msg.action)),
    ) as unknown as typeof chrome.tabs.sendMessage;
  chrome.tabs.get = vi.fn();
}

/** The origin probe every load makes before `loadEntity` runs. */
const originReply: SendResponse = { success: true, data: FAKE_ORIGIN };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useUserContext user-info reduction', () => {
  it('exposes the detected user when the probe succeeds with data', async () => {
    const userInfo = { userId: '00uFAKE1', userName: 'Fake User' };
    mockOktaTab((action) =>
      action === 'getUserInfo' ? { success: true, data: userInfo } : originReply,
    );

    const { result } = renderHook(() => useUserContext());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.userInfo).toEqual(userInfo);
    expect(result.current.connectionStatus).toBe('connected');
  });

  it('ignores the payload of an unsuccessful probe', async () => {
    // A reply can carry a stale/partial `data` alongside `success: false` — the
    // page is simply not a user page. Rendering it would invent a user.
    mockOktaTab((action) =>
      action === 'getUserInfo'
        ? { success: false, data: { userId: '00uFAKE9', userName: 'Should Not Render' } }
        : originReply,
    );

    const { result } = renderHook(() => useUserContext());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.userInfo).toBeNull();
    // Still a healthy connection: "no user on this page" is not an error.
    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.error).toBeNull();
  });

  it('normalises a successful but empty probe to null', async () => {
    mockOktaTab((action) => (action === 'getUserInfo' ? { success: true } : originReply));

    const { result } = renderHook(() => useUserContext());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.userInfo).toBeNull();
    expect(result.current.connectionStatus).toBe('connected');
  });
});
