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

/**
 * The composition `App` runs: one engine, narrowed to the group on screen.
 *
 * RETARGETED (ADR-0058). `useGroupContext` no longer starts a probe of its own — it
 * is a selector over the single `useOktaPageContext` engine — so every case below
 * that used it as the vehicle for exercising the shared engine now drives it
 * through the engine it selects over. Each assertion is carried across unchanged:
 * the same probe responses still yield the same `groupInfo`, `connectionStatus`,
 * `error`, `targetTabId` and `oktaOrigin`, and the same listener/latch/backoff
 * machinery is under test. Nothing was thinned.
 */
const useGroupContextEngine = () => useGroupContext(useOktaPageContext());

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

    const { result } = renderHook(() => useGroupContextEngine());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.groupInfo).toEqual({ groupId: '00g1', groupName: 'Engineering' });
    expect(result.current.oktaOrigin).toBe('https://acme.okta.com');
    expect(result.current.targetTabId).toBe(42);
    expect(result.current.error).toBeNull();
  });

  it('reports connected-with-null when on Okta admin but not a group page', async () => {
    mockOktaTab(origin); // getGroupInfo → { success: false }

    const { result } = renderHook(() => useGroupContextEngine());

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

      const { result } = renderHook(() => useGroupContextEngine());

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

  it('reports pageType "unknown" — never "admin" — when the probe never landed', async () => {
    // ADR-0058's behaviour change, and the reason the two failure semantics stay
    // two fields. `admin` is the *successful* answer "an admin console page that
    // carries no entity"; claiming it for a probe that learnt nothing let a dead
    // content script render a masthead indistinguishable from a healthy landing
    // page. A failed probe now says it knows nothing.
    vi.useFakeTimers();
    try {
      (chrome as unknown as { windows: unknown }).windows = {
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
      };
      chrome.tabs.query = vi
        .fn()
        .mockResolvedValue([{ id: 42, url: 'https://acme.okta.com/admin/groups', active: true }]);
      chrome.tabs.get = vi.fn();
      chrome.tabs.sendMessage = vi
        .fn()
        .mockRejectedValue(
          new Error('Could not establish connection. Receiving end does not exist.'),
        ) as unknown as typeof chrome.tabs.sendMessage;

      const { result } = renderHook(() => useOktaPageContext());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20000);
      });

      expect(result.current.connectionStatus).toBe('error');
      expect(result.current.pageType).toBe('unknown');
    } finally {
      vi.useRealTimers();
    }
  });

  it('narrows the one engine to null on a non-group page, keeping tab + origin', async () => {
    // The whole of `useGroupContext` after ADR-0058: a selector, not a probe. The
    // group is dropped because the page is a user page, while the transport state
    // every feature tab consumes comes straight through.
    mockOktaTab((action) => {
      if (action === 'getUserInfo')
        return { success: true, data: { userId: '00u1', userName: 'Jane Doe' } };
      return origin(action);
    });

    const { result } = renderHook(() => useGroupContextEngine());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.groupInfo).toBeNull();
    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.targetTabId).toBe(42);
    expect(result.current.oktaOrigin).toBe('https://acme.okta.com');
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
    const { result } = renderHook(() => useGroupContextEngine());
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
    const { result } = renderHook(() => useGroupContextEngine());
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
    const { result } = renderHook(() => useGroupContextEngine());
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

describe('useOktaTabContext reload recovery', () => {
  /** The tab URL `mockOktaTab` uses by default — the "same entity" for these tests. */
  const groupUrl = 'https://acme.okta.com/admin/groups';

  const groupResponder = (action: string): SendResponse =>
    action === 'getGroupInfo'
      ? { success: true, data: { groupId: '00g1', groupName: 'Engineering' } }
      : origin(action);

  type OnUpdated = (
    id: number,
    change: { url?: string; status?: string },
    tab: chrome.tabs.Tab,
  ) => void;

  /**
   * Wire chrome.* for one Okta tab whose content script never answers, mirroring a
   * page that is still loading or whose script was orphaned by an extension reload.
   * Returns the `sendMessage` mock so a test can later let it succeed ("tab reloaded").
   */
  function mockUnreachableTab() {
    (chrome as unknown as { windows: unknown }).windows = {
      getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
    };
    chrome.tabs.query = vi.fn().mockResolvedValue([{ id: 42, url: groupUrl, active: true }]);
    chrome.tabs.get = vi.fn();
    const sendMessage = vi
      .fn()
      .mockRejectedValue(
        new Error('Could not establish connection. Receiving end does not exist.'),
      );
    chrome.tabs.sendMessage = sendMessage as unknown as typeof chrome.tabs.sendMessage;
    return sendMessage;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setVisibility('visible');
  });

  afterEach(() => {
    setVisibility('visible');
    vi.useRealTimers();
  });

  it('recovers from error when the Okta tab is reloaded at the same URL', async () => {
    vi.useFakeTimers();
    const sendMessage = mockUnreachableTab();

    const { result } = renderHook(() => useGroupContextEngine());

    // Burn the whole retry budget so the hook lands in the terminal error state.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(result.current.connectionStatus).toBe('error');

    // The user hits F5: a fresh content script is now listening.
    sendMessage.mockImplementation((_tabId: number, msg: { action: string }) =>
      Promise.resolve(groupResponder(msg.action)),
    );

    // Chrome reports a document load as `status: 'complete'` with NO changeInfo.url.
    const onUpdated = lastListener<OnUpdated>(chrome.tabs.onUpdated.addListener);
    await act(async () => {
      onUpdated(42, { status: 'complete' }, { url: groupUrl } as chrome.tabs.Tab);
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current.connectionStatus).toBe('connected');
    expect(result.current.groupInfo).toEqual({ groupId: '00g1', groupName: 'Engineering' });
    expect(result.current.error).toBeNull();
  });

  it('re-probes on a same-URL document reload while already connected', async () => {
    mockOktaTab(groupResponder);
    const { result } = renderHook(() => useGroupContextEngine());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.connectionStatus).toBe('connected');

    const before = sendCount();
    const onUpdated = lastListener<OnUpdated>(chrome.tabs.onUpdated.addListener);

    onUpdated(42, { status: 'complete' }, { url: groupUrl } as chrome.tabs.Tab);

    await waitFor(() => expect(sendCount()).toBeGreaterThan(before));
  });

  it('does not latch the entity URL after a failed attempt', async () => {
    vi.useFakeTimers();
    mockUnreachableTab();

    const { result } = renderHook(() => useGroupContextEngine());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(result.current.connectionStatus).toBe('error');

    const before = sendCount();
    const onUpdated = lastListener<OnUpdated>(chrome.tabs.onUpdated.addListener);

    // A plain (non-forced) event for the *same* entity URL still refetches, because
    // the failed attempt left no suppression latch behind.
    await act(async () => {
      onUpdated(42, { url: groupUrl }, { url: groupUrl } as chrome.tabs.Tab);
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(sendCount()).toBeGreaterThan(before);
  });

  it('clears a pending backoff retry on unmount', async () => {
    vi.useFakeTimers();
    mockUnreachableTab();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = renderHook(() => useGroupContextEngine());

    // Let the first attempt fail and schedule a backoff retry (first delay: 500ms).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    const afterFirstAttempt = sendCount();
    expect(afterFirstAttempt).toBeGreaterThan(0);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });

    expect(sendCount()).toBe(afterFirstAttempt);
    // The failure this guards is React's "state update on an unmounted component"
    // — a retry timer firing after teardown. React 19 (this repo pins ^19.2.0)
    // deleted that warning's text outright in favour of the act() one, so the old
    // `/not wrapped in act|unmounted component/i` alternation could only ever
    // match on its first half: the second described a warning no installed React
    // can emit. Naming only the message that can actually fire makes the
    // assertion say what it checks; it does not narrow what it catches. (D-022)
    expect(
      consoleError.mock.calls.filter(([first]) => /not wrapped in act/i.test(String(first))),
    ).toEqual([]);
    consoleError.mockRestore();
  });
});

/**
 * The masthead's feed, after the Overview tab was removed.
 *
 * `App` used to pass `activeTab === 'overview' && !isPinned` here, which was
 * correct only while the one consumer of the detection *was* that tab. The
 * `ContextBar` masthead renders above the rail on every tab, so it is ungated by
 * tab — and these cases are what stop it drifting back.
 *
 * Since ADR-0058 `App` passes nothing at all: the pin can no longer be expressed
 * as `enabled: false`, because the one engine also carries the connection health a
 * pinned masthead must keep reporting. `enabled` remains the engine's own
 * dual-axis gate (ADR-0026) and is pinned here on its own terms.
 */
describe('useOktaPageContext enablement', () => {
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

  /** Fire a real cross-entity navigation at the most recent `onUpdated` listener. */
  function navigateTo(url: string): void {
    const onUpdated = lastListener<
      (id: number, change: { url?: string }, tab: chrome.tabs.Tab) => void
    >(chrome.tabs.onUpdated.addListener);
    onUpdated(42, { url }, { url } as chrome.tabs.Tab);
  }

  it('re-detects on navigation while enabled, whatever tab is on screen', async () => {
    // The whole point of the re-gate: the bar must not go stale because the
    // reader is looking at Groups rather than at Home.
    mockOktaTab(groupResponder);
    const { result } = renderHook(() => useOktaPageContext(true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const before = sendCount();
    navigateTo('https://acme.okta.com/admin/groups/00gOTHER');
    await waitFor(() => expect(sendCount()).toBeGreaterThan(before));
  });

  it('stays inert once disabled', async () => {
    // RETARGETED (ADR-0058): the case was written as "stays inert once pinned",
    // when `App` passed `!isPinned` here. The pin now lives in `App` — see
    // `App.contextengine.test.tsx` — so what this pins is the engine's own
    // contract: once disabled, a navigation must not move it. Same transition
    // (detect, then disable), same assertion, unchanged.
    mockOktaTab(groupResponder);
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useOktaPageContext(enabled),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ enabled: false });
    const before = sendCount();
    navigateTo('https://acme.okta.com/admin/groups/00gOTHER');
    await afterDebounce();
    expect(sendCount()).toBe(before);
  });

  it('stays inert while the panel is hidden, even though it is always enabled', async () => {
    // ADR-0026's gate, on the hook that is now always-on. Always-enabled must
    // not mean always-probing: a side panel nobody is looking at costs nothing.
    mockOktaTab(groupResponder);
    const { result } = renderHook(() => useOktaPageContext(true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const before = sendCount();
    setVisibility('hidden');
    navigateTo('https://acme.okta.com/admin/groups/00gHIDDEN');
    await afterDebounce();
    expect(sendCount()).toBe(before);

    setVisibility('visible');
    document.dispatchEvent(new globalThis.Event('visibilitychange'));
    await waitFor(() => expect(sendCount()).toBeGreaterThan(before));
  });
});
