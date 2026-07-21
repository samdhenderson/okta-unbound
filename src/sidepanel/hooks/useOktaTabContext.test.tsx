import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useGroupContext } from './useGroupContext';
import { useUserContext } from './useUserContext';
import { useOktaPageContext } from './useOktaPageContext';

type SendResponse = { success: boolean; data?: unknown };

/** Grab the most recently registered listener from a mocked `addListener`. */
function lastListener<T>(addListener: unknown): T {
  const calls = (addListener as { mock: { calls: unknown[][] } }).mock.calls;
  return calls[calls.length - 1][0] as T;
}

/** Count of content-script messages sent so far (a proxy for "did we refetch"). */
function sendCount(): number {
  return (chrome.tabs.sendMessage as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
}

/** Override document visibility (jsdom exposes both as read-only getters). */
function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  Object.defineProperty(document, 'hidden', { value: state === 'hidden', configurable: true });
}

/** Wait one debounce window plus slack, then let microtasks settle. */
const afterDebounce = () => new Promise((r) => setTimeout(r, 250));

/** Wire chrome.* mocks for a single active Okta tab, with a per-action responder. */
function mockOktaTab(responder: (action: string) => SendResponse, tabs?: unknown[]) {
  (chrome as unknown as { windows: unknown }).windows = {
    getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
  };
  chrome.tabs.query = vi
    .fn()
    .mockResolvedValue(
      tabs ?? [{ id: 42, url: 'https://acme.okta.com/admin/groups', active: true }],
    );
  chrome.tabs.sendMessage = vi
    .fn()
    .mockImplementation((_tabId: number, msg: { action: string }) =>
      Promise.resolve(responder(msg.action)),
    ) as unknown as typeof chrome.tabs.sendMessage;
  chrome.tabs.get = vi.fn();
}

const origin = (action: string): SendResponse =>
  action === 'getOktaOrigin'
    ? { success: true, data: 'https://acme.okta.com' }
    : { success: false };

describe('useOktaTabContext (via context hooks)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useGroupContext connects and returns group info on a group page', async () => {
    mockOktaTab((action) => {
      if (action === 'getGroupInfo')
        return { success: true, data: { groupId: '00g1', groupName: 'Engineering' } };
      return origin(action);
    });

    const { result } = renderHook(() => useGroupContext());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.groupInfo).toEqual({ groupId: '00g1', groupName: 'Engineering' });
    expect(result.current.oktaOrigin).toBe('https://acme.okta.com');
    expect(result.current.targetTabId).toBe(42);
    expect(result.current.error).toBeNull();
  });

  it('reports connected-with-null when on Okta admin but not a group page', async () => {
    mockOktaTab(origin); // getGroupInfo → { success: false }

    const { result } = renderHook(() => useGroupContext());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.groupInfo).toBeNull();
  });

  it('surfaces an error when no Okta tab is open', async () => {
    mockOktaTab(origin, []); // no tabs in the window

    const { result } = renderHook(() => useUserContext());

    await waitFor(() => expect(result.current.connectionStatus).toBe('error'));
    expect(result.current.error).toMatch(/Okta admin page/);
    expect(result.current.userInfo).toBeNull();
  });

  it('useOktaPageContext detects a user page', async () => {
    mockOktaTab((action) => {
      if (action === 'getUserInfo')
        return { success: true, data: { userId: '00u1', userName: 'Jane Doe' } };
      return origin(action);
    });

    const { result } = renderHook(() => useOktaPageContext());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.pageType).toBe('user');
    expect(result.current.userInfo).toEqual({ userId: '00u1', userName: 'Jane Doe' });
    expect(result.current.groupInfo).toBeNull();
    expect(result.current.appInfo).toBeNull();
  });

  it('reports error (not a fake "connected") when the content script is unreachable', async () => {
    vi.useFakeTimers();
    try {
      (chrome as unknown as { windows: unknown }).windows = {
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
      };
      chrome.tabs.query = vi
        .fn()
        .mockResolvedValue([{ id: 42, url: 'https://acme.okta.com/admin/groups', active: true }]);
      chrome.tabs.get = vi.fn();
      // Every message rejects, like a tab whose content script never loaded /
      // was orphaned by an extension reload.
      chrome.tabs.sendMessage = vi
        .fn()
        .mockRejectedValue(
          new Error('Could not establish connection. Receiving end does not exist.'),
        ) as unknown as typeof chrome.tabs.sendMessage;

      const { result } = renderHook(() => useGroupContext());

      // Exhaust the full capped-backoff retry budget (~11.5s of timers). Wrapped
      // in act so React flushes the state updates fired from timer callbacks.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20000);
      });

      expect(result.current.connectionStatus).toBe('error');
      expect(result.current.groupInfo).toBeNull();
      expect(result.current.error).toMatch(/reconnect/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it('useOktaPageContext falls back to admin when no entity is detected', async () => {
    mockOktaTab(origin); // all entity probes → { success: false }

    const { result } = renderHook(() => useOktaPageContext());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.pageType).toBe('admin');
    expect(result.current.connectionStatus).toBe('connected');
  });
});

describe('useOktaTabContext detection hygiene', () => {
  const groupResponder = (action: string): SendResponse =>
    action === 'getGroupInfo'
      ? { success: true, data: { groupId: '00g1', groupName: 'Engineering' } }
      : origin(action);

  beforeEach(() => {
    vi.clearAllMocks();
    setVisibility('visible');
  });

  afterEach(() => {
    setVisibility('visible');
  });

  it('does not refetch on a hash-only URL change', async () => {
    mockOktaTab(groupResponder); // initial tab url: .../admin/groups
    const { result } = renderHook(() => useGroupContext());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const before = sendCount();
    const onUpdated = lastListener<
      (id: number, change: { url?: string }, tab: chrome.tabs.Tab) => void
    >(chrome.tabs.onUpdated.addListener);

    // Same page, new fragment — Okta's in-page section tabs.
    const hashUrl = 'https://acme.okta.com/admin/groups#assignments';
    onUpdated(42, { url: hashUrl }, { url: hashUrl } as chrome.tabs.Tab);

    await afterDebounce();
    expect(sendCount()).toBe(before);
  });

  it('refetches when navigating to a different entity URL', async () => {
    mockOktaTab(groupResponder);
    const { result } = renderHook(() => useGroupContext());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const before = sendCount();
    const onUpdated = lastListener<
      (id: number, change: { url?: string }, tab: chrome.tabs.Tab) => void
    >(chrome.tabs.onUpdated.addListener);

    const nextUrl = 'https://acme.okta.com/admin/groups/00gOTHER';
    onUpdated(42, { url: nextUrl }, { url: nextUrl } as chrome.tabs.Tab);

    await waitFor(() => expect(sendCount()).toBeGreaterThan(before));
  });

  it('defers refetch while the panel is hidden and catches up when shown', async () => {
    mockOktaTab(groupResponder);
    const { result } = renderHook(() => useGroupContext());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const before = sendCount();
    const onUpdated = lastListener<
      (id: number, change: { url?: string }, tab: chrome.tabs.Tab) => void
    >(chrome.tabs.onUpdated.addListener);

    // Hidden: a real navigation must NOT fetch.
    setVisibility('hidden');
    const nextUrl = 'https://acme.okta.com/admin/groups/00gHIDDEN';
    onUpdated(42, { url: nextUrl }, { url: nextUrl } as chrome.tabs.Tab);
    await afterDebounce();
    expect(sendCount()).toBe(before);

    // Shown again: exactly one catch-up fetch runs.
    setVisibility('visible');
    document.dispatchEvent(new globalThis.Event('visibilitychange'));
    await waitFor(() => expect(sendCount()).toBeGreaterThan(before));
  });
});
