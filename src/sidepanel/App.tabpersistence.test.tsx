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

/** The org the panel resolves; the snapshot is scoped by it. */
const ORIGIN = 'https://example.okta.com';

// ---------------------------------------------------------------------------
// IndexedDB fake
// ---------------------------------------------------------------------------
// The Groups list comes from the background-owned org snapshot (ADR-0040), which
// is IndexedDB-backed. jsdom has no IndexedDB and `fake-indexeddb` is not a
// dependency, so `idb` is faked with a Map, as `GroupsTab.test.tsx` does.
// `collectionReads` is what replaces the `chrome.storage.local` read counter the
// "does not re-run the cache read on return" case used to assert against.
const { fakeDB, idbTables, collectionReads } = vi.hoisted(() => {
  const idbTables = new Map<string, Map<string, any>>();
  const collectionReads: string[] = [];
  const keyOf = (key: unknown) => (Array.isArray(key) ? key.join('::') : String(key));
  const table = (name: string) => {
    if (!idbTables.has(name)) idbTables.set(name, new Map());
    return idbTables.get(name)!;
  };
  const pk = (name: string, value: any) =>
    name === 'syncMeta' ? [value.origin, value.collection] : [value.origin, value.id];
  const fakeDB = {
    get: async (name: string, key: unknown) => table(name).get(keyOf(key)),
    put: async (name: string, value: any) => {
      table(name).set(keyOf(pk(name, value)), value);
    },
    delete: async (name: string, key: unknown) => {
      table(name).delete(keyOf(key));
    },
    getAllFromIndex: async (name: string, _i: string, origin: string) => {
      collectionReads.push(name);
      return [...table(name).values()].filter((v) => v.origin === origin);
    },
    getAllKeysFromIndex: async (name: string, _i: string, origin: string) =>
      [...table(name).values()].filter((v) => v.origin === origin).map((v) => pk(name, v)),
    transaction: (name: string) => ({
      store: {
        put: async (value: any) => {
          table(name).set(keyOf(pk(name, value)), value);
        },
        delete: async (key: unknown) => {
          table(name).delete(keyOf(key));
        },
      },
      done: Promise.resolve(),
    }),
  };
  return { fakeDB, idbTables, collectionReads };
});

vi.mock('idb', () => ({ openDB: vi.fn(async () => fakeDB) }));

const OKTA_TAB = {
  id: 1,
  active: true,
  url: `${ORIGIN}/admin/groups`,
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

/** Write `cachedGroup()`-shaped fixtures into the snapshot the Groups tab reads. */
function seedGroupsCache(groups: Record<string, any>[]) {
  const table = new Map<string, unknown>();
  for (const summary of groups) {
    const entity = {
      id: summary.id,
      type: summary.type ?? 'OKTA_GROUP',
      profile: { name: summary.name, description: summary.description ?? null },
      lastUpdated: summary.lastUpdated,
      created: summary.created,
      _embedded: { stats: { usersCount: summary.memberCount ?? 0 } },
    };
    table.set(`${ORIGIN}::${entity.id}`, { origin: ORIGIN, id: entity.id, entity, syncedAt: 1 });
  }
  idbTables.set('groups', table);
  idbTables.set(
    'syncMeta',
    new Map([
      [
        `${ORIGIN}::groups`,
        {
          origin: ORIGIN,
          collection: 'groups',
          complete: true,
          lastFullWalkAt: 1,
          lastDeltaAt: null,
          watermark: null,
          itemCount: groups.length,
          cursor: null,
          walkStartedAt: null,
          deltaSupported: null,
        },
      ],
    ]),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  idbTables.clear();
  collectionReads.length = 0;

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
    if (msg.action === 'getOktaOrigin') return { success: true, data: ORIGIN };
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

/**
 * Click a top-level tab in the app's ARIA tablist.
 *
 * Scoped by its `aria-label` ("Main sections", `TabNavigation.tsx`) rather than
 * the bare role: once a group is drilled into, `GroupDetailView`'s own
 * Members/Access/Rules tab strip (`GroupDetailView.tsx`) is a second `tablist`
 * on screen, and an unscoped `getByRole('tablist')` would ambiguously match
 * both.
 */
async function openTab(uev: ReturnType<typeof userEvent.setup>, label: string) {
  await uev.click(
    within(screen.getByRole('tablist', { name: 'Main sections' })).getByRole('tab', {
      name: label,
    }),
  );
}

/**
 * How long a wait that crosses a tab's **first** activation gets.
 *
 * Every tab in this file is lazy, which is the whole point of the suite — so the
 * first `openTab` for a given tab pays a dynamic `import()` that later ones do
 * not. Testing Library's default `findBy*` budget is 1s, which is under that
 * cost whenever the module graph is cold or the machine is loaded. That is why
 * this file passed inside a full-suite run (some earlier file had already warmed
 * the chunk) and failed when run on its own. The budget below is the wait these
 * call sites always meant; it matches the explicit budgets already used for
 * multi-step loads in `UsersTab.test.tsx`.
 */
const TAB_MOUNT_TIMEOUT = 5000;

/** A group row, once the Groups tab's lazy chunk has mounted and its cache read has landed. */
const groupRow = (name: string) =>
  screen.findByLabelText(`Select ${name}`, {}, { timeout: TAB_MOUNT_TIMEOUT });

/** A heading that exists only once its own lazy tab chunk has mounted. */
const tabHeading = (name: string) =>
  screen.findByRole('heading', { name }, { timeout: TAB_MOUNT_TIMEOUT });

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

/** How many `/api/v1/apps` reads the panel has issued through the scheduler. */
/**
 * The `syncSnapshot` requests the panel made, newest last.
 *
 * RETARGETED for ADR-0040: the Applications inventory is no longer paged by the
 * panel, so there is no `/apps` scheduler message to count. What the panel still
 * decides — and what these cases are about — is *whether it asks at all*.
 */
const syncMessages = () =>
  runtimeSendMessage.mock.calls
    .map(([m]) => m)
    .filter((m) => m?.action === 'syncSnapshot') as Array<{ origin?: string }>;

const appCalls = () => syncMessages().length;

/**
 * Point the panel at a different Okta tab, optionally on a different org, and wait
 * for the re-probe to land so the new target has reached every mounted tab.
 *
 * Then give any re-armed auto-load a real chance to fire: a hidden tab must not take
 * it, and asserting that requires waiting long enough that a failure to gate would
 * actually show up.
 */
async function retargetTo({ id, origin }: { id: number; origin?: string }) {
  const probesBefore = tabsSendMessage.mock.calls.length;
  const onUpdated = (chrome.tabs.onUpdated.addListener as ReturnType<typeof vi.fn>).mock
    .calls[0][0] as (
    tabId: number,
    changeInfo: { status?: string; url?: string },
    tab: typeof OKTA_TAB,
  ) => void;

  if (origin) {
    tabsSendMessage.mockImplementation(async (_tabId: number, msg: { action: string }) => {
      if (msg.action === 'getOktaOrigin') return { success: true, data: origin };
      return { success: false };
    });
  }
  const tab = { ...OKTA_TAB, id, url: `${origin ?? 'https://example.okta.com'}/admin/groups` };
  (chrome.tabs.query as ReturnType<typeof vi.fn>).mockResolvedValue([tab]);
  onUpdated(id, { status: 'complete' }, tab);

  await waitFor(() => expect(tabsSendMessage.mock.calls.length).toBeGreaterThan(probesBefore));
  await new Promise((resolve) => setTimeout(resolve, 250));
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
    expect(await groupRow('Engineering')).toBeInTheDocument();
  });

  it('keeps a visited tab mounted (hidden) after switching away', async () => {
    const uev = userEvent.setup();
    renderApp();

    await openTab(uev, 'Groups');
    const row = await groupRow('Engineering');

    await openTab(uev, 'Rules');
    await tabHeading('Group Rules');

    // Still in the document, just inside a hidden panel — not unmounted.
    expect(row).toBeInTheDocument();
    expect(row).not.toBeVisible();
  });

  it('restores the open group detail view, its filter and its selection after a trip to Rules', async () => {
    const uev = userEvent.setup();
    renderApp();

    await openTab(uev, 'Groups');
    await groupRow('Engineering');

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
    await tabHeading('Group Rules');
    await openTab(uev, 'Groups');

    // Same detail view, still open, on the same group. The group id itself now
    // lives in the Health tab's folded "About this group" section
    // (`GroupInsightsPane.tsx`, step 8 of the Group Detail rework) rather than
    // always-visible below the tab card — switch there before asserting on it.
    const detail = screen.getByTestId('group-detail-view');
    expect(detail).toBeVisible();
    await uev.click(
      within(detail).getByRole('tab', {
        name: 'Insights',
      }),
    );
    expect(within(detail).getByText('g1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to groups' })).toBeVisible();

    // …and the list behind it is intact: same query, same selection.
    await uev.click(screen.getByRole('button', { name: 'Back to groups' }));
    expect(screen.getByPlaceholderText('Search by name, description, ID — or /regex/')).toHaveValue(
      'Engin',
    );
    expect(screen.getByLabelText('Select Engineering')).toBeChecked();
  });

  it('leaves the first tab mounted and does not re-run the Groups cache read on return', async () => {
    const uev = userEvent.setup();
    renderApp();

    // RETARGETED (ADR-0040): the rehydrate reads the snapshot rather than
    // `chrome.storage.local`, so the read being counted is the IndexedDB one.
    // RETARGETED again (Home tab): Home reads the `groups` collection at boot to
    // resolve pasted ids, so the count no longer starts at zero. Measuring the
    // *delta* isolates the Groups tab's own rehydrate from the shell's, which is
    // what this case was always about — the absolute total was only ever a proxy.
    const groupReads = () => collectionReads.filter((name) => name === 'groups').length;

    // Wait for the shell's own snapshot reads to land before taking a baseline.
    // Home reads groups, rules and apps once each on mount, and sampling before
    // those resolve would attribute one of them to the Groups tab.
    await waitFor(() => {
      expect(collectionReads).toContain('rules');
      expect(collectionReads).toContain('apps');
      expect(collectionReads).toContain('groups');
    });
    const beforeGroups = groupReads();

    await openTab(uev, 'Groups');
    await groupRow('Engineering');
    const afterGroups = groupReads();
    expect(afterGroups - beforeGroups).toBe(1);

    await openTab(uev, 'Apps');
    await openTab(uev, 'Groups');

    // A remount would rehydrate all over again; a hidden tab does not.
    expect(groupReads()).toBe(afterGroups);
  });

  it("restores each tab's own scroll offset on return, not the offset it was left at", async () => {
    const uev = userEvent.setup();
    renderApp();

    await openTab(uev, 'Groups');
    await groupRow('Engineering');

    // Every root-scrolling tab shares this one element, which is precisely why the
    // offset has to be banked per tab rather than read back off the container.
    const root = scrollRoot();
    scrollTo(root, 240);

    await openTab(uev, 'Rules');
    await tabHeading('Group Rules');
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
    await groupRow('Engineering');
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
    await tabHeading('Applications');
    await waitFor(() => expect(appCalls()).toBeGreaterThan(0));

    await openTab(uev, 'Groups');
    await groupRow('Engineering');
    const before = appCalls();

    // Re-target the panel at a different Okta tab on the SAME org. That re-arms the
    // Apps auto-load, which must stay armed rather than fire from a tab the user
    // cannot see.
    await retargetTo({ id: 2 });
    expect(appCalls()).toBe(before);

    // Showing the tab pays the owed load. RETARGETED (ADR-0040): it used to be
    // asserted as "costs no request", because the panel owned the cache and could
    // see the hit. The panel now always asks and the background's freshness
    // ladder decides — for this same-org re-target, a drift check or nothing at
    // all. That the ask is cheap is `shared/snapshot/snapshotSync.test.ts`'s to
    // pin; that it is the SAME org being asked about is this one's.
    await openTab(uev, 'Apps');
    await waitFor(() => expect(appCalls()).toBe(before + 1));
    expect(syncMessages().at(-1)?.origin).toBe(ORIGIN);
  });

  it('re-fetches the inventory when the connected tab moves to a different org', async () => {
    const uev = userEvent.setup();
    renderApp();

    await openTab(uev, 'Apps');
    await tabHeading('Applications');
    await waitFor(() => expect(appCalls()).toBeGreaterThan(0));

    await openTab(uev, 'Groups');
    await groupRow('Engineering');
    const before = appCalls();

    // A different org is a different snapshot by construction — rows are scoped
    // by origin precisely so one org's apps can never be served for another's.
    await retargetTo({ id: 2, origin: 'https://other.okta.com' });

    // Still inert while hidden: deferred, not dropped.
    expect(appCalls()).toBe(before);

    // …and paid on the next show, against the new org.
    await openTab(uev, 'Apps');
    await waitFor(() => expect(appCalls()).toBe(before + 1));
    expect(syncMessages().at(-1)?.origin).toBe('https://other.okta.com');
  });
});
