/**
 * App-level tab-lifetime tests (WP8).
 *
 * These pin the contract the whole side panel now depends on: a tab **mounts on
 * its first activation and is hidden — never unmounted — thereafter**, so leaving
 * a tab and coming back restores exactly what was on screen. The reported bug was
 * the Groups tab: drill into a group, follow one of its feeding rules to the Rules
 * tab, come back, and the detail view (plus filters and selection behind it) was
 * gone, because `{activeTab === 'groups' && <GroupsTab/>}` unmounted the subtree.
 *
 * Also pinned here: tabs are still lazy (a never-visited tab renders nothing), and
 * a hidden tab stays inert — the Applications inventory auto-load must not fire
 * from a tab the user cannot see.
 *
 * Message passing is chrome-based (not fetch), so MSW does not apply — the chrome
 * surface is mocked the same way `GroupsTab.navigation.test.tsx` does.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { ProgressProvider } from './contexts/ProgressContext';

const GROUPS_CACHE_KEY = 'okta_unbound_groups_cache';
const OKTA_TAB = {
  id: 1,
  active: true,
  url: 'https://example.okta.com/admin/groups',
  windowId: 1,
};

const runtimeSendMessage = vi.fn();
const tabsSendMessage = vi.fn();
const storageGet = vi.fn();
const storageSet = vi.fn();

/** A serialized GroupSummary — i.e. what lives in `chrome.storage.local`. */
function cachedGroup(over: Record<string, unknown> = {}) {
  return {
    id: 'g1',
    name: 'Engineering',
    description: 'Eng team',
    type: 'OKTA_GROUP',
    memberCount: 10,
    lastUpdated: '2024-01-01T00:00:00.000Z',
    created: '2020-01-01T00:00:00.000Z',
    hasRules: false,
    ruleCount: 0,
    selected: false,
    ...over,
  };
}

/**
 * Serve the groups cache to the callback-style read and `{}` to everything else
 * (the persisted tab id, the pinned context, the promise-style RulesCache read),
 * so both calling conventions work.
 */
function seedGroupsCache(groups: Record<string, unknown>[]) {
  const payload = {
    [GROUPS_CACHE_KEY]: JSON.stringify({ groups, timestamp: Date.now() }),
  };
  storageGet.mockImplementation((keys: unknown, cb?: (r: unknown) => void) => {
    const wantsGroups = Array.isArray(keys) && keys.includes(GROUPS_CACHE_KEY);
    const result = wantsGroups ? payload : {};
    if (typeof cb === 'function') return cb(result);
    return Promise.resolve(result);
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  globalThis.chrome = {
    runtime: {
      sendMessage: runtimeSendMessage,
      getURL: (p: string) => p,
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      lastError: undefined,
    },
    tabs: {
      query: vi.fn(async () => [OKTA_TAB]),
      get: vi.fn(),
      reload: vi.fn(),
      sendMessage: tabsSendMessage,
      onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
      onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    windows: { getCurrent: vi.fn(async () => ({ id: 1 })) },
    storage: {
      local: { get: storageGet, set: storageSet, remove: vi.fn() },
      sync: { get: storageGet, set: storageSet, remove: vi.fn() },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  } as unknown as typeof chrome;

  seedGroupsCache([cachedGroup()]);

  // The side panel is on an Okta *group* page, so the panel resolves an origin
  // and a target tab id without any of the tabs having to ask for one.
  tabsSendMessage.mockImplementation(async (_tabId: number, msg: { action: string }) => {
    if (msg.action === 'getOktaOrigin') return { success: true, data: 'https://example.okta.com' };
    return { success: false };
  });

  runtimeSendMessage.mockImplementation(async () => ({ success: true, data: [] }));
});

const renderApp = () =>
  render(
    <ProgressProvider>
      <App />
    </ProgressProvider>,
  );

/** Click a top-level tab in the ARIA tablist. */
async function openTab(uev: ReturnType<typeof userEvent.setup>, label: string) {
  await uev.click(within(screen.getByRole('tablist')).getByRole('tab', { name: label }));
}

/** Drill into a group row: expand it, then open its detail view. */
async function drillInto(uev: ReturnType<typeof userEvent.setup>, name: string) {
  const row = screen.getByLabelText(`Select ${name}`).closest('[data-group-id]') as HTMLElement;
  await uev.click(within(row).getByRole('button', { name: 'Expand' }));
  await uev.click(within(row).getByRole('button', { name: 'View group details' }));
}

/**
 * The one element that actually scrolls, with a writable `scrollTop`.
 *
 * jsdom does no layout, so nothing ever overflows and `scrollTop` is permanently a
 * read-only `0` — redefining it as a data property is the only way to observe the
 * offsets the code under test reads and writes. Same trick as
 * `GroupsTab.navigation.test.tsx`.
 */
function scrollRoot(): HTMLElement {
  const node = screen.getByTestId('app-scroll-root');
  if (!Object.getOwnPropertyDescriptor(node, 'scrollTop')) {
    Object.defineProperty(node, 'scrollTop', { value: 0, writable: true, configurable: true });
  }
  return node;
}

/** Scroll the shared container and let the passive mirror observe it. */
function scrollTo(node: HTMLElement, top: number) {
  node.scrollTop = top;
  node.dispatchEvent(new Event('scroll'));
}

describe('App tab lifetime', () => {
  it('mounts a tab only once it has been activated', async () => {
    const uev = userEvent.setup();
    renderApp();

    // Never visited: the Groups tab has rendered nothing at all, so the lazy
    // chunk was never fetched.
    expect(
      screen.queryByPlaceholderText(/Search by name, description, ID/),
    ).not.toBeInTheDocument();

    await openTab(uev, 'Groups');
    expect(await screen.findByLabelText('Select Engineering')).toBeInTheDocument();
  });

  it('keeps a visited tab mounted (hidden) after switching away', async () => {
    const uev = userEvent.setup();
    renderApp();

    await openTab(uev, 'Groups');
    const row = await screen.findByLabelText('Select Engineering');

    await openTab(uev, 'Rules');
    await screen.findByRole('heading', { name: 'Group Rules' });

    // Still in the document, just inside a hidden panel — not unmounted.
    expect(row).toBeInTheDocument();
    expect(row).not.toBeVisible();
  });

  it('restores the open group detail view, its filter and its selection after a trip to Rules', async () => {
    const uev = userEvent.setup();
    renderApp();

    await openTab(uev, 'Groups');
    await screen.findByLabelText('Select Engineering');

    // Accumulate the state the bug report says is lost: a search filter, a
    // selected row, and a pushed detail view.
    await uev.type(
      screen.getByPlaceholderText('Search by name, description, ID — or /regex/'),
      'Engin',
    );
    await uev.click(screen.getByLabelText('Select Engineering'));
    await drillInto(uev, 'Engineering');
    expect(screen.getByTestId('group-detail-view')).toBeInTheDocument();

    // The trip that used to lose it all.
    await openTab(uev, 'Rules');
    await screen.findByRole('heading', { name: 'Group Rules' });
    await openTab(uev, 'Groups');

    // Same detail view, still open, on the same group.
    const detail = screen.getByTestId('group-detail-view');
    expect(detail).toBeVisible();
    expect(within(detail).getByText('g1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to groups' })).toBeVisible();

    // …and the list behind it is intact: same query, same selection.
    await uev.click(screen.getByRole('button', { name: 'Back to groups' }));
    expect(screen.getByPlaceholderText('Search by name, description, ID — or /regex/')).toHaveValue(
      'Engin',
    );
    expect(screen.getByLabelText('Select Engineering')).toBeChecked();
  });

  it('leaves the Overview mounted and does not re-run the Groups cache read on return', async () => {
    const uev = userEvent.setup();
    renderApp();

    await openTab(uev, 'Groups');
    await screen.findByLabelText('Select Engineering');
    const cacheReads = storageGet.mock.calls.filter(
      ([keys]) => Array.isArray(keys) && keys.includes(GROUPS_CACHE_KEY),
    ).length;
    expect(cacheReads).toBe(1);

    await openTab(uev, 'Apps');
    await openTab(uev, 'Groups');

    // A remount would rehydrate from storage all over again; a hidden tab does not.
    expect(
      storageGet.mock.calls.filter(
        ([keys]) => Array.isArray(keys) && keys.includes(GROUPS_CACHE_KEY),
      ),
    ).toHaveLength(cacheReads);
  });

  it("restores each tab's own scroll offset on return, not the offset it was left at", async () => {
    const uev = userEvent.setup();
    renderApp();

    await openTab(uev, 'Groups');
    await screen.findByLabelText('Select Engineering');

    // Every root-scrolling tab shares this one element, which is precisely why the
    // offset has to be banked per tab rather than read back off the container.
    const root = scrollRoot();
    scrollTo(root, 240);

    await openTab(uev, 'Rules');
    await screen.findByRole('heading', { name: 'Group Rules' });
    scrollTo(root, 90);

    await openTab(uev, 'Groups');
    expect(root.scrollTop).toBe(240);

    await openTab(uev, 'Rules');
    expect(root.scrollTop).toBe(90);
  });

  it('opens a newly activated tab at the top rather than the previous tab’s offset', async () => {
    const uev = userEvent.setup();
    renderApp();

    await openTab(uev, 'Groups');
    await screen.findByLabelText('Select Engineering');
    const root = scrollRoot();
    scrollTo(root, 320);

    // Apps has never been activated, so it has no offset of its own to restore —
    // and it must not inherit the Groups tab's position on the shared container.
    await openTab(uev, 'Apps');
    expect(root.scrollTop).toBe(0);
  });

  it('does not let a hidden Applications tab re-load the inventory when the Okta tab changes', async () => {
    const uev = userEvent.setup();
    renderApp();

    await openTab(uev, 'Apps');
    await screen.findByRole('heading', { name: 'Applications' });
    await waitFor(() =>
      expect(
        runtimeSendMessage.mock.calls.some(([m]) => String(m?.endpoint ?? '').includes('/apps')),
      ).toBe(true),
    );

    await openTab(uev, 'Groups');
    await screen.findByLabelText('Select Engineering');
    const appCalls = () =>
      runtimeSendMessage.mock.calls.filter(([m]) => String(m?.endpoint ?? '').includes('/apps'))
        .length;
    const before = appCalls();

    // Re-target the panel at a different Okta tab. That re-arms the Apps
    // auto-load (it is armed once per connected tab id), which must stay armed
    // rather than fire from a tab the user cannot see.
    const probesBefore = tabsSendMessage.mock.calls.length;
    const onUpdated = (chrome.tabs.onUpdated.addListener as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as (
      tabId: number,
      changeInfo: { status?: string; url?: string },
      tab: typeof OKTA_TAB,
    ) => void;
    (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([{ ...OKTA_TAB, id: 2 }]);
    onUpdated(2, { status: 'complete' }, { ...OKTA_TAB, id: 2 });

    // The re-probe has landed (a fresh `getOktaOrigin` round trip), so the new
    // target tab id has reached every mounted tab. Give the re-armed auto-load
    // every chance to fire anyway.
    await waitFor(() => expect(tabsSendMessage.mock.calls.length).toBeGreaterThan(probesBefore));
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(appCalls()).toBe(before);

    // Deferred, not dropped: it runs the moment the tab is shown again.
    await openTab(uev, 'Apps');
    await waitFor(() => expect(appCalls()).toBe(before + 1));
  });
});
