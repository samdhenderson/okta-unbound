/**
 * Tests for {@link useUserContext}'s `loadEntity` response guard (`DEBT.md` D-006).
 *
 * The hook is a thin wrapper over `useOktaTabContext`; the only logic it owns is
 * one line — `response.success && response.data ? response.data : null` — which
 * decides whether the active tab is reported as showing an Okta user. Both sides
 * matter to the UI: the truthy side drives the "you are on this user" context,
 * and the falsy side is what keeps a *connected* Okta admin tab that simply isn't
 * a user page from rendering a phantom user.
 *
 * The falsy side is covered once per operand, because each is separately
 * load-bearing: `success: false` (the page-context probe found no user), a
 * failure response that nonetheless carries data, and a successful response with
 * no `data` at all.
 *
 * `chrome.tabs` is mocked directly (this hook talks to the content script for
 * page context, not through the API scheduler, so there is no `useOktaApi`
 * facade in the path). All identifiers are fake placeholders.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUserContext } from './useUserContext';
import type { UserInfo } from '../../shared/types';

type SendResponse = { success: boolean; data?: unknown };

/** Obviously fake org; it only has to satisfy `isOktaUrl`'s hostname check. */
const FAKE_ORIGIN = 'https://fake-org.okta.com';
const FAKE_TAB_URL = `${FAKE_ORIGIN}/admin/user/profile/view/00uFAKEUSER1`;

const USER: UserInfo = {
  userId: '00uFAKEUSER1',
  userName: 'Fake User',
  userEmail: 'user@example.com',
};

/** Wire `chrome.*` for a single active Okta tab with a per-action responder. */
function mockOktaTab(responder: (action: string) => SendResponse) {
  (chrome as unknown as { windows: unknown }).windows = {
    getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
  };
  chrome.tabs.query = vi.fn().mockResolvedValue([{ id: 42, url: FAKE_TAB_URL, active: true }]);
  chrome.tabs.get = vi.fn();
  chrome.tabs.sendMessage = vi
    .fn()
    .mockImplementation((_tabId: number, msg: { action: string }) =>
      Promise.resolve(responder(msg.action)),
    ) as unknown as typeof chrome.tabs.sendMessage;
}

/** The origin probe every `loadEntity` run makes before asking for the entity. */
const originResponse: SendResponse = { success: true, data: FAKE_ORIGIN };

describe('useUserContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports the user when the content script returns one', async () => {
    mockOktaTab((action) =>
      action === 'getUserInfo' ? { success: true, data: USER } : originResponse,
    );

    const { result } = renderHook(() => useUserContext());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.userInfo).toEqual(USER);
    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.oktaOrigin).toBe(FAKE_ORIGIN);
    expect(result.current.targetTabId).toBe(42);
  });

  it('reports no user — while staying connected — when the probe fails', async () => {
    // An Okta admin page that is not a user page: the content script answers,
    // but reports no user. Connected with `userInfo: null`, not an error.
    mockOktaTab((action) => (action === 'getUserInfo' ? { success: false } : originResponse));

    const { result } = renderHook(() => useUserContext());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.userInfo).toBeNull();
    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.error).toBeNull();
  });

  it('does not trust a failure response that still carries a payload', async () => {
    // Defensive: today's `handleGetUserInfo` never answers `success: false` with
    // data, so this pins the `success` operand of the guard specifically — a
    // responder that regressed into returning both must not be believed.
    mockOktaTab((action) =>
      action === 'getUserInfo' ? { success: false, data: USER } : originResponse,
    );

    const { result } = renderHook(() => useUserContext());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.userInfo).toBeNull();
  });

  it('reports no user when a successful response carries no data', async () => {
    mockOktaTab((action) => (action === 'getUserInfo' ? { success: true } : originResponse));

    const { result } = renderHook(() => useUserContext());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.userInfo).toBeNull();
    expect(result.current.connectionStatus).toBe('connected');
  });
});
