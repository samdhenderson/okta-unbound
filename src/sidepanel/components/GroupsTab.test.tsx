/**
 * CHARACTERIZATION TESTS for GroupsTab.
 *
 * These pin the behavior of GroupsTab **as it exists today**, ahead of the §7
 * decomposition. Several assertions below deliberately encode behavior that is
 * arguably wrong (last-resolving-wins live search, the cache/load race, the
 * activeFilterCount vs. clearFilters mismatch, the in-place mutation of the
 * member cache). Do not "fix" a test here — if the behavior should change, change
 * it in its own commit and update the matching test there.
 *
 * Message passing is chrome-based (not fetch), so MSW does not apply; we mock the
 * chrome messaging surface exactly as `hooks/useOktaApi.test.ts` does, and drive
 * the REAL useOktaApi so scheduler traffic is observable.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render as rtlRender,
  screen,
  within,
  act,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';
import GroupsTab from './GroupsTab';
import { ProgressProvider } from '../contexts/ProgressContext';
import { syncSnapshot } from '../../background/snapshotBridge';

// GroupsTab now consumes ProgressContext (the merge flow reports progress), so
// every render wraps it in a ProgressProvider — the same provider main.tsx gives
// the app. This only supplies the context; no assertions change.
const render = (ui: ReactElement, options?: Parameters<typeof rtlRender>[1]) =>
  rtlRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ProgressProvider>{children}</ProgressProvider>
    ),
    ...options,
  });

// ---------------------------------------------------------------------------
// Child test doubles — the feature children are separately-owned units; we stub
// them so we can observe the props GroupsTab brokers (identity stability, the
// always-mounted modals, the shared member-cache Map).
// ---------------------------------------------------------------------------
const captured = vi.hoisted(() => ({
  props: {} as Record<string, any>,
}));

vi.mock('./groups/GroupExportModal', () => ({
  default: (props: any) => {
    captured.props.GroupExportModal = props;
    return (
      <div data-testid="export-modal" data-open={String(props.isOpen)}>
        {props.groups.map((g: any) => (
          <span key={g.id} data-testid="export-modal-group">
            {g.name}
          </span>
        ))}
      </div>
    );
  },
}));

vi.mock('./groups/GroupComparisonModal', () => ({
  default: (props: any) => {
    captured.props.GroupComparisonModal = props;
    return <div data-testid="comparison-modal" data-open={String(props.isOpen)} />;
  },
}));

vi.mock('./groups/CrossGroupSearch', () => ({
  default: (props: any) => {
    captured.props.CrossGroupSearch = props;
    return <div data-testid="cross-group-search" />;
  },
}));

vi.mock('./groups/BulkOperationsPanel', () => ({
  default: (props: any) => {
    captured.props.BulkOperationsPanel = props;
    return <div data-testid="bulk-panel" />;
  },
}));

vi.mock('./groups/GroupCollections', () => ({
  default: (props: any) => {
    captured.props.GroupCollections = props;
    return <div data-testid="collections-panel" />;
  },
}));

vi.mock('../../shared/undoManager', () => ({
  logAction: vi.fn(),
  logBulkRemoveAction: vi.fn(),
  logBulkAddAction: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Deferred push-mapping enrichment
// ---------------------------------------------------------------------------
// Push mappings are no longer a stored field. Before ADR-0040 a fixture could
// declare `pushMappings` because the whole `GroupSummary` was serialized into
// `chrome.storage.local`; the snapshot stores raw Okta rows, and the mappings are
// *derived* from the `appGroups` collection the background walks (ADR-0040).
//
// So the filter/export cases below seed that collection directly rather than
// replaying the fan-out. They render without loading, so nothing walks and
// nothing sweeps what they seeded. The fan-out itself is pinned in
// `shared/snapshot/snapshotSync.test.ts`, and the derivation in
// `hooks/useGroupsLoader.test.tsx`.

// ---------------------------------------------------------------------------
// IndexedDB fake
// ---------------------------------------------------------------------------
// The group list now comes from the background-owned org snapshot (ADR-0040),
// which is IndexedDB-backed. jsdom has no IndexedDB and `fake-indexeddb` is not a
// dependency here, so `idb` is faked with a Map exactly as
// `shared/snapshot/orgSnapshotStore.test.ts` fakes it.
const { fakeDB, idbTables } = vi.hoisted(() => {
  const idbTables = new Map<string, Map<string, any>>();
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
    getAllFromIndex: async (name: string, _i: string, origin: string) =>
      [...table(name).values()].filter((v) => v.origin === origin),
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
  return { fakeDB, idbTables };
});

vi.mock('idb', () => ({ openDB: vi.fn(async () => fakeDB) }));

// ---------------------------------------------------------------------------
// chrome mocks
// ---------------------------------------------------------------------------
const runtimeSendMessage = vi.fn();
const tabsSendMessage = vi.fn();
const storageGet = vi.fn();
const storageSet = vi.fn();
const tabsGet = vi.fn();

/** The org every test renders against; the snapshot is scoped by origin. */
const ORIGIN = 'https://x.okta.com';

/**
 * Listeners the panel registered on `chrome.runtime.onMessage`. The snapshot's
 * per-page `snapshotUpdated` broadcast is how the list repaints mid-walk, so
 * these are really invoked rather than stubbed away.
 */
const runtimeListeners = new Set<(msg: any) => void>();

globalThis.chrome = {
  runtime: {
    sendMessage: runtimeSendMessage,
    getURL: (p: string) => p,
    onMessage: {
      addListener: (fn: any) => runtimeListeners.add(fn),
      removeListener: (fn: any) => runtimeListeners.delete(fn),
    },
  },
  tabs: { sendMessage: tabsSendMessage, get: tabsGet },
  storage: {
    local: { get: storageGet, set: storageSet, remove: vi.fn() },
    // The header's working-set pin subscribes here (`useWorkingSet`).
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
} as any;

/** Endpoint -> response router for the background scheduler. */
type Route = [RegExp, (msg: any) => any];
let routes: Route[] = [];
function route(pattern: RegExp, respond: (msg: any) => any) {
  routes.push([pattern, respond]);
}

function schedulerCalls() {
  return (
    runtimeSendMessage.mock.calls
      .map((c) => c[0])
      // Scheduled API requests only. The same channel also carries plan-ledger
      // control messages (ADR-0060), which have no endpoint or method and would
      // otherwise show up as untyped entries in every assertion built on this.
      .filter((m: any) => m?.action === 'scheduleApiRequest')
  );
}

// §8: live search now routes through the scheduler as a single
// `GET /api/v1/groups?q=…&limit=20&expand=stats` at the `interactive` priority
// (not a direct `searchGroups` content-script message). These helpers isolate and
// route that traffic.
const SEARCH_RE = /^\/api\/v1\/groups\?q=/;
/** Scheduler messages that are live group searches (endpoint + tabId + priority). */
function searchCalls() {
  return schedulerCalls().filter((m: any) => SEARCH_RE.test(m.endpoint));
}
/** Route the live group-search endpoint to `respond` (msg -> RequestResult). */
function routeSearch(respond: (msg: any) => any) {
  route(SEARCH_RE, respond);
}

/**
 * The rules and apps listings the snapshot walks alongside groups.
 *
 * `syncOrg` walks all three collections in one pass, so a test that exercises a
 * real load routes them all — otherwise the unrouted legs report a failure and
 * the sync's verdict is one the panel banners.
 */
function routeSiblingCollections(rules: any[] = [], apps: any[] = []) {
  route(/^\/api\/v1\/groups\/rules\?limit=200$/, () => ({
    success: true,
    headers: {},
    data: rules,
  }));
  route(/^\/api\/v1\/apps\?limit=200$/, () => ({ success: true, headers: {}, data: apps }));
}

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------
function rawGroup(over: Record<string, any> = {}) {
  return {
    id: 'g1',
    type: 'OKTA_GROUP',
    created: '2020-01-01T00:00:00.000Z',
    lastUpdated: '2024-01-01T00:00:00.000Z',
    profile: { name: 'Engineering', description: 'Eng team' },
    _embedded: { stats: { usersCount: 10 } },
    ...over,
  };
}

/** A serialized GroupSummary, i.e. what lives in chrome.storage.local. */
function cachedGroup(over: Record<string, any> = {}) {
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

function user(id: string, over: Record<string, any> = {}) {
  return {
    id,
    status: 'ACTIVE',
    profile: { firstName: 'A', lastName: id, email: `${id}@x.com`, login: `${id}@x.com` },
    ...over,
  };
}

/**
 * The inverse of `toGroupSummary`, so the existing `cachedGroup()` fixtures can
 * seed the snapshot unchanged.
 *
 * The snapshot stores raw Okta rows, not summaries — the mapping to a
 * `GroupSummary` is now the loader's job. Rather than rewrite forty fixtures
 * into raw shape, this converts them, which keeps every downstream assertion
 * about filtering, sorting and selection reading exactly as it did.
 */
function summaryToRaw(summary: Record<string, any>): Record<string, any> {
  const raw: Record<string, any> = {
    id: summary.id,
    type: summary.type ?? 'OKTA_GROUP',
    profile: { name: summary.name, description: summary.description ?? null },
    lastUpdated: summary.lastUpdated,
    created: summary.created,
    _embedded: { stats: { usersCount: summary.memberCount ?? 0 } },
  };
  if (summary.sourceAppId) {
    raw.source = { id: summary.sourceAppId, name: summary.sourceAppName };
  }
  return raw;
}

/** Write rows straight into the snapshot store the panel reads from. */
function seedSnapshot(
  collection: string,
  rows: Record<string, any>[],
  origin = ORIGIN,
  complete = true,
) {
  const table = new Map<string, any>();
  for (const entity of rows) {
    table.set(`${origin}::${entity.id}`, { origin, id: entity.id, entity, syncedAt: 1 });
  }
  idbTables.set(collection, table);
  idbTables.set(
    'syncMeta',
    new Map([
      [
        `${origin}::${collection}`,
        {
          origin,
          collection,
          complete,
          lastFullWalkAt: complete ? 1 : null,
          lastDeltaAt: null,
          watermark: null,
          itemCount: rows.length,
          cursor: null,
          walkStartedAt: null,
          deltaSupported: null,
        },
      ],
    ]),
  );
}

/**
 * Seed the snapshot with `cachedGroup()`-shaped fixtures and render.
 *
 * Async where the old storage-backed helper was synchronous: the snapshot read
 * is a promise, so the first paint lands a microtask later. Awaiting one `act`
 * flush is what replaces the old un-awaited `chrome.storage.local` callback —
 * and is why the "stale wins" race this suite used to pin no longer has a
 * mechanism.
 */
async function renderCached(groups: Record<string, any>[], props: Record<string, any> = {}) {
  seedSnapshot('groups', groups.map(summaryToRaw));
  seedPushEnrichment(groups);
  const result = render(<GroupsTab targetTabId={1} oktaOrigin={ORIGIN} {...props} />);
  await act(async () => {});
  return result;
}

/**
 * Seed the collections a fixture's `pushMappings` / `sourceAppName` are derived
 * from.
 *
 * Neither field can round-trip through `summaryToRaw` — Okta returns neither on
 * a group row — so they are written where the panel actually reads them: the
 * `appGroups` collection for the mappings, and `apps` for the labels.
 *
 * `appGroups` is keyed `${appId}::${groupId}`, because Okta returns the assigned
 * group's id on an assignment and the app it belongs to exists only in the key.
 */
function seedPushEnrichment(groups: Record<string, any>[]) {
  const assignments = new Map<string, any>();
  const apps = new Map<string, any>();

  const rememberApp = (appId: string, appName?: string) => {
    if (!appId || !appName) return;
    apps.set(`${ORIGIN}::${appId}`, {
      origin: ORIGIN,
      id: appId,
      entity: { id: appId, label: appName, features: ['GROUP_PUSH'] },
      syncedAt: 1,
    });
  };

  for (const group of groups) {
    rememberApp(group.sourceAppId, group.sourceAppName);
    for (const mapping of group.pushMappings ?? []) {
      const appId = mapping.appId ?? 'appFixture';
      const id = `${appId}::${group.id}`;
      assignments.set(`${ORIGIN}::${id}`, {
        origin: ORIGIN,
        id,
        entity: {
          id: group.id,
          priority: mapping.priority,
          profile: { name: mapping.targetGroupName ?? group.name },
          _links: { group: { href: `${ORIGIN}/api/v1/groups/${group.id}` } },
        },
        syncedAt: 1,
      });
      rememberApp(appId, mapping.appName);
    }
  }

  if (assignments.size > 0) idbTables.set('appGroups', assignments);
  if (apps.size > 0) idbTables.set('apps', apps);
}

/**
 * The group rows currently in the list, in render order. Keyed off each row's
 * select-checkbox rather than its heading, so an EmptyState heading is never
 * mistaken for a group.
 */
function renderedGroupNames() {
  return screen
    .queryAllByRole('checkbox')
    .map((c) => c.getAttribute('aria-label') ?? '')
    .filter((l) => l.startsWith('Select '))
    .map((l) => l.slice('Select '.length));
}

/** The wrapper div of a labelled filter section, for scoped button queries. */
function section(label: string) {
  return within(screen.getByText(label).parentElement as HTMLElement);
}

/**
 * Fake ONLY the timer functions the debounce uses — vitest's default `toFake` set
 * also stubs queueMicrotask/nextTick, which deadlocks Testing Library's async
 * wrapper. Timer tests drive the UI with `fireEvent` (synchronous) rather than
 * userEvent, whose async wrapper hangs under fake timers.
 */
function useDebounceTimers() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
}

/** One change event per character — exactly what a controlled input sees while typing. */
function typeInto(input: HTMLElement, text: string) {
  let acc = (input as HTMLInputElement).value;
  for (const ch of text) {
    acc += ch;
    fireEvent.change(input, { target: { value: acc } });
  }
}

function setValue(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

/** Advance fake timers past the 300ms live-search debounce and flush the response. */
async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

const liveInput = () => screen.getByPlaceholderText('Search groups by name...');

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * A minimal `ApiScheduler` stand-in for the snapshot bridge: it answers from the
 * same `routes` table every other request in this suite uses, so a snapshot walk
 * is scripted with `route(...)` exactly like a scheduler call.
 */
const fakeScheduler = {
  scheduleRequest: async (endpoint: string) => {
    walkCalls.push(endpoint);
    for (const [pattern, respond] of routes) {
      if (pattern.test(endpoint)) return respond({ endpoint });
    }
    return { success: false, error: `unrouted endpoint: ${endpoint}` };
  },
} as any;

/**
 * Endpoints the snapshot walk asked for. Separate from {@link schedulerCalls}:
 * a walk is issued by the *background*, so it never passes through the panel's
 * `chrome.runtime.sendMessage`.
 */
let walkCalls: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  routes = [];
  walkCalls = [];
  captured.props = {};
  idbTables.clear();
  runtimeListeners.clear();
  storageGet.mockImplementation((_keys: string[], cb: (r: any) => void) => cb({}));
  tabsGet.mockImplementation(async (id: number) => ({ id, url: `${ORIGIN}/admin/groups` }));
  runtimeSendMessage.mockImplementation(async (msg: any) => {
    // `snapshotUpdated` is the background broadcasting to the panel; deliver it
    // to the listeners the panel actually registered so the list repaints.
    if (msg?.action === 'snapshotUpdated') {
      for (const listener of runtimeListeners) listener(msg);
      return undefined;
    }
    // A real walk, driven through the real bridge and the real sync engine, so
    // the pages a test scripts are the pages the snapshot ends up holding.
    if (msg?.action === 'syncSnapshot') {
      try {
        const outcomes = await syncSnapshot(fakeScheduler, msg.origin, msg.tabId);
        const failed = outcomes.find((o) => !o.complete);
        return { success: !failed, error: failed?.error, outcomes };
      } catch (error: any) {
        return { success: false, error: error?.message };
      }
    }
    for (const [pattern, respond] of routes) {
      if (pattern.test(msg.endpoint)) return respond(msg);
    }
    return { success: false, error: `unrouted endpoint: ${msg.endpoint}` };
  });
});

afterEach(() => {
  vi.useRealTimers();
});

// ===========================================================================
// 1. Live-search debounce contract — the highest-value pin. A dep-identity
//    regression here fails silently (search just stops working).
// ===========================================================================
describe('live search: debounce contract', () => {
  it('fires exactly one scheduler search 300ms after the last keystroke', async () => {
    useDebounceTimers();
    routeSearch(() => ({ success: true, data: [] }));

    render(<GroupsTab targetTabId={1} />);

    typeInto(liveInput(), 'eng');

    await advance(299);
    expect(searchCalls()).toHaveLength(0);

    await advance(1);
    expect(searchCalls()).toHaveLength(1);
    expect(searchCalls()[0]).toMatchObject({
      action: 'scheduleApiRequest',
      endpoint: '/api/v1/groups?q=eng&limit=20&expand=stats',
      tabId: 1,
      priority: 'interactive',
    });
  });

  it('restarts the 300ms window on every keystroke', async () => {
    useDebounceTimers();
    routeSearch(() => ({ success: true, data: [] }));

    render(<GroupsTab targetTabId={1} />);
    const input = liveInput();

    setValue(input, 'e');
    await advance(200);
    setValue(input, 'en');
    await advance(200);
    setValue(input, 'eng');
    await advance(200);
    // 600ms of typing, but never 300ms of quiet.
    expect(searchCalls()).toHaveLength(0);

    await advance(100);
    expect(searchCalls()).toHaveLength(1);
    expect(searchCalls()[0].endpoint).toBe('/api/v1/groups?q=eng&limit=20&expand=stats');
  });

  it('still fires exactly once when unrelated re-renders happen mid-debounce', async () => {
    useDebounceTimers();
    routeSearch(() => ({ success: true, data: [] }));

    const { rerender } = render(<GroupsTab targetTabId={1} oktaOrigin="https://a.okta.com" />);

    typeInto(liveInput(), 'eng');

    // Force re-renders that must NOT reschedule the timer. If handleLiveSearch ever
    // loses its stable identity, the effect re-runs and the search never fires.
    for (let i = 0; i < 5; i++) {
      rerender(<GroupsTab targetTabId={1} oktaOrigin={`https://a${i}.okta.com`} />);
      await advance(50);
    }
    await advance(300);

    expect(searchCalls()).toHaveLength(1);
    expect(searchCalls()[0].endpoint).toBe('/api/v1/groups?q=eng&limit=20&expand=stats');
  });

  it('re-fires the search when targetTabId changes', async () => {
    useDebounceTimers();
    routeSearch(() => ({ success: true, data: [] }));

    const { rerender } = render(<GroupsTab targetTabId={1} />);
    typeInto(liveInput(), 'eng');
    await advance(300);
    runtimeSendMessage.mockClear();

    rerender(<GroupsTab targetTabId={2} />);
    await advance(300);

    expect(searchCalls()).toHaveLength(1);
    expect(searchCalls()[0]).toMatchObject({ tabId: 2, priority: 'interactive' });
  });

  it('does not re-fire on a targetTabId change while the tab is hidden, and catches up on return', async () => {
    // App keeps every visited tab mounted, so this effect stays alive after the
    // user has moved on. Re-issuing the last typed query from a tab nobody can
    // see is Okta traffic with no reader.
    useDebounceTimers();
    routeSearch(() => ({ success: true, data: [] }));

    const { rerender } = render(<GroupsTab targetTabId={1} isActive />);
    typeInto(liveInput(), 'eng');
    await advance(300);
    runtimeSendMessage.mockClear();

    rerender(<GroupsTab targetTabId={2} isActive={false} />);
    await advance(300);
    expect(searchCalls()).toHaveLength(0);

    rerender(<GroupsTab targetTabId={2} isActive />);
    await advance(300);
    expect(searchCalls()).toHaveLength(1);
    expect(searchCalls()[0]).toMatchObject({ tabId: 2, priority: 'interactive' });
  });

  it('routes live search through the background scheduler, never a direct content call (§8)', async () => {
    useDebounceTimers();
    routeSearch(() => ({ success: true, data: [rawGroup()] }));

    render(<GroupsTab targetTabId={1} />);
    typeInto(liveInput(), 'eng');
    await advance(300);

    expect(searchCalls()).toHaveLength(1);
    expect(tabsSendMessage).not.toHaveBeenCalled();
  });

  it('renders mapped live results (memberCount from expand=stats)', async () => {
    useDebounceTimers();
    routeSearch(() => ({
      success: true,
      data: [rawGroup({ id: 'g1', profile: { name: 'Engineering' } })],
    }));

    render(<GroupsTab targetTabId={1} />);
    typeInto(liveInput(), 'eng');
    await advance(300);

    expect(renderedGroupNames()).toEqual(['Engineering']);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('members')).toBeInTheDocument();
  });
});

// ===========================================================================
// 2. Live-search error paths
// ===========================================================================
describe('live search: error paths', () => {
  it('with no targetTabId: banners "No Okta tab connected", sends nothing, shows no spinner', async () => {
    useDebounceTimers();

    render(<GroupsTab targetTabId={null} />);
    typeInto(liveInput(), 'eng');
    await advance(300);

    expect(screen.getByText('No Okta tab connected')).toBeInTheDocument();
    expect(searchCalls()).toHaveLength(0);
    expect(document.querySelector('.animate-spin')).toBeNull();
  });

  it('with a whitespace-only query: clears results, sends nothing, shows no spinner', async () => {
    useDebounceTimers();
    routeSearch(() => ({ success: true, data: [rawGroup()] }));

    render(<GroupsTab targetTabId={1} />);
    const input = liveInput();
    typeInto(input, 'eng');
    await advance(300);
    expect(renderedGroupNames()).toEqual(['Engineering']);
    runtimeSendMessage.mockClear();

    setValue(input, '   ');
    await advance(300);

    expect(searchCalls()).toHaveLength(0);
    expect(renderedGroupNames()).toEqual([]);
    expect(document.querySelector('.animate-spin')).toBeNull();
  });

  it('on response.success === false: banners response.error and clears results', async () => {
    useDebounceTimers();
    routeSearch(() => ({ success: false, error: 'Okta said no' }));

    render(<GroupsTab targetTabId={1} />);
    typeInto(liveInput(), 'eng');
    await advance(300);

    expect(screen.getByText('Okta said no')).toBeInTheDocument();
    expect(renderedGroupNames()).toEqual([]);
    expect(document.querySelector('.animate-spin')).toBeNull();
  });

  it('when the scheduler request rejects: banners the rejection message and clears results', async () => {
    useDebounceTimers();
    routeSearch(() => {
      throw new Error('Receiving end does not exist');
    });

    render(<GroupsTab targetTabId={1} />);
    typeInto(liveInput(), 'eng');
    await advance(300);
    // The transport now retries transient port errors on GET with 250ms/500ms
    // backoff before surfacing the rejection; flush each delay separately so
    // the timer scheduled after each attempt's microtask gets to fire.
    await advance(250);
    await advance(500);

    expect(screen.getByText('Receiving end does not exist')).toBeInTheDocument();
    expect(renderedGroupNames()).toEqual([]);
    expect(document.querySelector('.animate-spin')).toBeNull();
  });

  it('the error banner is dismissible', async () => {
    useDebounceTimers();
    routeSearch(() => ({ success: false, error: 'Okta said no' }));

    render(<GroupsTab targetTabId={1} />);
    typeInto(liveInput(), 'eng');
    await advance(300);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(screen.queryByText('Okta said no')).not.toBeInTheDocument();
  });

  // SURPRISE (pinned as-is): there is no request-id / stale-response guard, so the
  // LAST-RESOLVING response wins — not the last-issued one.
  it('lets an out-of-order (older) response overwrite a newer one', async () => {
    useDebounceTimers();
    const first = deferred<any>();
    const second = deferred<any>();
    let call = 0;
    routeSearch(() => (call++ === 0 ? first.promise : second.promise));

    render(<GroupsTab targetTabId={1} />);
    const input = liveInput();

    setValue(input, 'a');
    await advance(300);
    setValue(input, 'ab');
    await advance(300);
    expect(searchCalls()).toHaveLength(2);

    // Newer request resolves FIRST, older one resolves SECOND.
    await act(async () => {
      second.resolve({
        success: true,
        data: [rawGroup({ id: 'g2', profile: { name: 'SECOND' } })],
      });
      await Promise.resolve();
    });
    await act(async () => {
      first.resolve({ success: true, data: [rawGroup({ id: 'g1', profile: { name: 'FIRST' } })] });
      await Promise.resolve();
    });

    // Current behavior: the stale first response wins.
    expect(renderedGroupNames()).toEqual(['FIRST']);
  });
});

// ===========================================================================
// 3. loadAllGroups
// ===========================================================================
describe('loadAllGroups', () => {
  it('maps, enriches with push mappings, caches, and flips to cached mode', async () => {
    const uev = userEvent.setup();
    // The app is in the org's inventory, which is where its label now comes from:
    // the walk stores every app, so naming one costs no request of its own.
    routeSiblingCollections([], [{ id: 'app123', label: 'Slack', features: ['GROUP_PUSH'] }]);
    route(/^\/api\/v1\/groups\?limit=200&expand=stats&expand=app$/, () => ({
      success: true,
      headers: {},
      data: [
        rawGroup({ id: 'g1', profile: { name: 'Engineering', description: 'Eng' } }),
        rawGroup({
          id: 'g2',
          type: 'APP_GROUP',
          profile: { name: 'Slack Users' },
          _links: { apps: { href: 'https://x.okta.com/api/v1/apps/app123' } },
          _embedded: { stats: { usersCount: 3 } },
        }),
      ],
    }));
    route(/^\/api\/v1\/apps\/app123\/groups\?limit=200$/, () => ({
      success: true,
      headers: {},
      data: [
        {
          id: 'm1',
          priority: 0,
          profile: { name: 'slack-eng' },
          _links: { group: { href: 'https://x.okta.com/api/v1/groups/g1' } },
        },
      ],
    }));

    render(<GroupsTab targetTabId={1} oktaOrigin={ORIGIN} />);
    await uev.click(screen.getByRole('button', { name: 'Load All Groups' }));

    await waitFor(() => expect(renderedGroupNames()).toEqual(['Engineering', 'Slack Users']));

    // Mode flipped to cached: the cached-mode search placeholder + selection bar appear.
    expect(
      screen.getByPlaceholderText('Search by name, description, ID — or /regex/'),
    ).toBeInTheDocument();
    expect(screen.getByText('2 Cached')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh/ })).toBeInTheDocument();

    // Every raw group was mapped to a summary: each row renders its type badge.
    expect(screen.getByText('OKTA')).toBeInTheDocument();
    expect(screen.getByText('APP')).toBeInTheDocument();

    // Push mappings applied to g1 and the app label resolved for the APP_GROUP.
    expect(screen.getByText('Slack')).toBeInTheDocument();

    // RETARGETED (ADR-0040): the load's durable output is the snapshot, not the
    // `chrome.storage.local` blob. Same three facts as before — the walk's rows
    // are persisted, their timestamps survive, and member counts came from the
    // `expand=stats` payload rather than a per-group fetch — now asserted
    // against the store the panel actually reads back from.
    const storedGroups = idbTables.get('groups')!;
    expect(storedGroups.size).toBe(2);
    const g1 = storedGroups.get(`${ORIGIN}::g1`).entity;
    expect(g1.lastUpdated).toBe('2024-01-01T00:00:00.000Z');
    expect(g1.created).toBe('2020-01-01T00:00:00.000Z');
    expect(g1._embedded.stats.usersCount).toBe(10);
    // And the collection is marked complete, so the list is the whole org.
    expect(idbTables.get('syncMeta')!.get(`${ORIGIN}::groups`).complete).toBe(true);
  });

  it('reads sourceAppId from group.source in preference to the _links.apps href', async () => {
    const uev = userEvent.setup();
    routeSiblingCollections();
    route(/^\/api\/v1\/groups\?limit=200&expand=stats&expand=app$/, () => ({
      success: true,
      headers: {},
      data: [
        rawGroup({
          id: 'g2',
          type: 'APP_GROUP',
          profile: { name: 'Slack Users' },
          _links: { apps: { href: 'https://x.okta.com/api/v1/apps/fromLinks' } },
          source: { id: 'fromSource', name: 'Slack Prod' },
        }),
      ],
    }));
    // Deliberately NOT routed: `/api/v1/apps/fromSource` is the app-label
    // lookup, and this group's name arrived embedded on the walk. Leaving it
    // unrouted means a regression that re-introduces the request fails loudly
    // here rather than being absorbed by a stub.
    route(/^\/api\/v1\/apps\/fromSource\/groups\?limit=200$/, () => ({
      success: true,
      headers: {},
      data: [],
    }));

    render(<GroupsTab targetTabId={1} oktaOrigin={ORIGIN} />);
    await uev.click(screen.getByRole('button', { name: 'Load All Groups' }));
    await waitFor(() => expect(renderedGroupNames()).toEqual(['Slack Users']));

    // RETARGETED TWICE, same subject throughout: *which id* wins — `source.id`
    // over the id parsed out of the `_links.apps` href. It first read that off
    // the app-label lookup, which the walk's `expand=app` embed now answers; it
    // now reads it off the app-group fan-out, which is keyed on the same
    // `sourceAppId`. That fan-out is issued by the *background*, so it lands in
    // `walkCalls` rather than in the panel's own scheduler messages.
    expect(walkCalls).toContain('/api/v1/apps/fromSource/groups?limit=200');
    expect(walkCalls.some((e) => e.includes('fromLinks'))).toBe(false);
    // And the name the embed carried is used rather than re-fetched.
    expect(walkCalls).not.toContain('/api/v1/apps/fromSource');
    // group.source.name !== group.source.id, so it is used as the app name.
    expect(screen.getByText('Slack Prod')).toBeInTheDocument();
  });

  // RETARGETED (ADR-0040 §7). The old pipeline threw away every page when a later
  // one failed, so a partial walk showed nothing. The snapshot keeps what it got —
  // those rows are real — and instead refuses to call the collection complete, so
  // the list is captioned as a prefix rather than presented as the org.
  it('keeps the pages it got when a later page fails, and captions the list as partial', async () => {
    const uev = userEvent.setup();
    routeSiblingCollections();
    route(/^\/api\/v1\/groups\?limit=200&expand=stats&expand=app$/, () => ({
      success: true,
      headers: { link: '<https://x.okta.com/api/v1/groups?after=g1&limit=200>; rel="next"' },
      data: [rawGroup({ id: 'g1', profile: { name: 'Page One' } })],
    }));
    route(/after=g1/, () => ({ success: false, error: 'page two exploded' }));

    render(<GroupsTab targetTabId={1} oktaOrigin={ORIGIN} />);
    await uev.click(screen.getByRole('button', { name: 'Load All Groups' }));

    await waitFor(() => expect(renderedGroupNames()).toEqual(['Page One']));
    // The row survived, and the snapshot knows it cannot vouch for the whole org.
    expect(idbTables.get('syncMeta')!.get(`${ORIGIN}::groups`).complete).toBe(false);
    // Which the UI says out loud, rather than letting one page read as the org.
    expect(screen.getByText(/did not finish/)).toBeInTheDocument();
  });

  it('on getAllGroups failure: banners the message, stops loading, writes no cache', async () => {
    const uev = userEvent.setup();
    routeSiblingCollections();
    route(/^\/api\/v1\/groups\?limit=200&expand=stats&expand=app$/, () => ({
      success: false,
      error: 'Failed to fetch groups',
    }));

    render(<GroupsTab targetTabId={1} oktaOrigin={ORIGIN} />);
    await uev.click(screen.getByRole('button', { name: 'Load All Groups' }));

    await waitFor(() => expect(screen.getByText('Failed to fetch groups')).toBeInTheDocument());
    // RETARGETED: nothing durable was written — the same fact the storage
    // assertion pinned, now read off the store the panel loads from.
    expect(idbTables.get('groups')?.size ?? 0).toBe(0);
    // Still in live mode; the button is enabled again.
    expect(screen.getByRole('button', { name: 'Load All Groups' })).toBeEnabled();
  });

  // Still true, and now structurally rather than by a nested try/catch: the push
  // pass runs *after* the list is on screen (ADR-0040), so it cannot fail the load.
  // RETARGETED (ADR-0040). The subject is unchanged — a push-mapping failure must
  // not take the group list down with it — but the thing that can fail moved. It
  // used to be the panel's per-app label lookup; it is now the background's
  // app-group fan-out, so the failure is injected there. Still structural rather
  // than a nested try/catch: the fan-out is a separate collection, and a
  // collection that fails leaves the ones that succeeded standing.
  it('on a failed push-mapping walk: no banner, groups still render, snapshot still written', async () => {
    const uev = userEvent.setup();
    routeSiblingCollections();
    route(/^\/api\/v1\/groups\?limit=200&expand=stats&expand=app$/, () => ({
      success: true,
      headers: {},
      data: [
        rawGroup({
          id: 'g2',
          type: 'APP_GROUP',
          profile: { name: 'Slack Users' },
          source: { id: 'app123', name: 'Slack' },
        }),
      ],
    }));
    route(/^\/api\/v1\/apps\/app123\/groups\?limit=200$/, () => {
      throw new Error('push mapping exploded');
    });

    render(<GroupsTab targetTabId={1} oktaOrigin={ORIGIN} />);
    await uev.click(screen.getByRole('button', { name: 'Load All Groups' }));

    await waitFor(() => expect(renderedGroupNames()).toEqual(['Slack Users']));
    expect(screen.queryByText('push mapping exploded')).not.toBeInTheDocument();
    // The single row still rendered fully — its type badge is present.
    expect(screen.getAllByText('APP')).toHaveLength(1);
    // The groups walk's rows are durable regardless of the fan-out's verdict.
    expect(idbTables.get('groups')!.size).toBe(1);
    // And the failed fan-out is not recorded as a complete one, so it retries
    // rather than presenting an empty collection as the org's push mappings.
    expect(idbTables.get('syncMeta')!.get(`${ORIGIN}::appGroups`).complete).toBe(false);
  });

  it('clears live search state when a load succeeds', async () => {
    useDebounceTimers();
    routeSearch(() => ({
      success: true,
      data: [rawGroup({ id: 'gLive', profile: { name: 'Live Result' } })],
    }));
    routeSiblingCollections();
    route(/^\/api\/v1\/groups\?limit=200&expand=stats&expand=app$/, () => ({
      success: true,
      headers: {},
      data: [rawGroup({ id: 'g1', profile: { name: 'Engineering' } })],
    }));

    render(<GroupsTab targetTabId={1} oktaOrigin={ORIGIN} />);
    typeInto(liveInput(), 'live');
    await advance(300);
    expect(renderedGroupNames()).toEqual(['Live Result']);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Load All Groups' }));
    });
    await advance(0);

    expect(renderedGroupNames()).toEqual(['Engineering']);
    // The cached-mode input is a different control and starts empty; the live query
    // and its results are both reset.
    expect(screen.getByPlaceholderText('Search by name, description, ID — or /regex/')).toHaveValue(
      '',
    );
  });
});

// ===========================================================================
// 4. Mount cache rehydrate
// ===========================================================================
describe('mount snapshot rehydrate', () => {
  // RETARGETED from 'mount cache rehydrate' (ADR-0040, ADR-0022). The subject of
  // this block — the un-awaited `chrome.storage.local` read in `useGroupsLoader`
  // — was deleted; the list is now seeded from the background-owned snapshot.
  // The two cases below are the ones whose subject survives, retargeted
  // assertion-by-assertion onto the new seam.
  //
  // Three cases were REMOVED because what they pinned no longer has a mechanism,
  // and what still needs covering is covered elsewhere:
  //
  //   - 'an expired entry (age >= 24h) is ignored and the mode stays live' and
  //     'malformed cache JSON does not throw and leaves the mode live' both pinned
  //     `parseGroupsCache`, a pure function over a JSON blob. Its whole module
  //     (`components/groups/groupsCache.ts`) has since been deleted — the
  //     ADR-0022 "the subject was deleted" case — because the snapshot replaced
  //     the storage slot it parsed. The snapshot's own freshness rules are
  //     covered by `shared/snapshot/syncMeta.test.ts` (`nextSyncMode`, TTL and
  //     completeness).
  //
  //   - 'a late storage callback overwrites freshly loaded groups (stale wins)'
  //     pinned a race the SURPRISE comment called out as arguably wrong. It is
  //     gone by construction: the snapshot read is awaited and guarded by an
  //     origin ref, so a late resolve for a superseded org is dropped rather than
  //     applied. `useGroupsLoader.test.tsx` pins that directly ("a late read for
  //     a superseded org is dropped"), so the concern keeps a test — one that
  //     asserts the fix instead of the defect.

  it('a seeded snapshot rehydrates groups and flips to cached mode', async () => {
    await renderCached([cachedGroup({ id: 'g1', name: 'Engineering' })]);

    expect(renderedGroupNames()).toEqual(['Engineering']);
    expect(screen.getByText('1 Cached')).toBeInTheDocument();
  });

  // The date mapping is only observable through the sort comparator, which calls
  // `lastUpdated.getTime()` — a raw ISO string would throw here.
  it('maps lastUpdated/created into real Dates', async () => {
    const uev = userEvent.setup();
    await renderCached([
      cachedGroup({ id: 'a', name: 'Older', lastUpdated: '2021-01-01T00:00:00.000Z' }),
      cachedGroup({ id: 'b', name: 'Newer', lastUpdated: '2024-01-01T00:00:00.000Z' }),
    ]);

    await uev.click(screen.getByRole('button', { name: /^Filters/ }));
    await uev.click(section('Sort by').getByRole('button', { name: /^Profile Updated/ }));

    expect(renderedGroupNames()).toEqual(['Newer', 'Older']);
  });

  it('an empty snapshot leaves the mode live', async () => {
    render(<GroupsTab targetTabId={1} oktaOrigin={ORIGIN} />);
    await act(async () => {});
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(renderedGroupNames()).toEqual([]);
  });
});

// ===========================================================================
// 5. Filter pipeline
// ===========================================================================
describe('filter pipeline (cached mode)', () => {
  const sizeFixtures = [
    cachedGroup({ id: 'a', name: 'Size0', memberCount: 0 }),
    cachedGroup({ id: 'b', name: 'Size49', memberCount: 49 }),
    cachedGroup({ id: 'c', name: 'Size50', memberCount: 50 }),
    cachedGroup({ id: 'd', name: 'Size199', memberCount: 199 }),
    cachedGroup({ id: 'e', name: 'Size200', memberCount: 200 }),
    cachedGroup({ id: 'f', name: 'Size999', memberCount: 999 }),
    cachedGroup({ id: 'g', name: 'Size1000', memberCount: 1000 }),
  ];

  async function openFilters(uev: ReturnType<typeof userEvent.setup>) {
    await uev.click(screen.getByRole('button', { name: /^Filters/ }));
  }

  it('text search matches name, description, or id (case-insensitively)', async () => {
    const uev = userEvent.setup();
    await renderCached([
      cachedGroup({ id: 'idmatch', name: 'Alpha', description: 'nope' }),
      cachedGroup({ id: 'b', name: 'ZebraTeam', description: 'nope' }),
      cachedGroup({ id: 'c', name: 'Gamma', description: 'A ZEBRA lives here' }),
    ]);
    const input = screen.getByPlaceholderText('Search by name, description, ID — or /regex/');

    await uev.type(input, 'zebra');
    expect(renderedGroupNames().sort()).toEqual(['Gamma', 'ZebraTeam']);

    await uev.clear(input);
    await uev.type(input, 'IDMATCH');
    expect(renderedGroupNames()).toEqual(['Alpha']);
  });

  it('type filter narrows to the chosen group type', async () => {
    const uev = userEvent.setup();
    await renderCached([
      cachedGroup({ id: 'a', name: 'OktaOne', type: 'OKTA_GROUP' }),
      cachedGroup({ id: 'b', name: 'AppOne', type: 'APP_GROUP' }),
      cachedGroup({ id: 'c', name: 'BuiltOne', type: 'BUILT_IN' }),
    ]);
    await openFilters(uev);

    await uev.click(section('Group Type').getByRole('button', { name: 'App' }));
    expect(renderedGroupNames()).toEqual(['AppOne']);

    await uev.click(section('Group Type').getByRole('button', { name: 'Built-in' }));
    expect(renderedGroupNames()).toEqual(['BuiltOne']);

    await uev.click(section('Group Type').getByRole('button', { name: 'All' }));
    expect(renderedGroupNames().sort()).toEqual(['AppOne', 'BuiltOne', 'OktaOne']);
  });

  it.each([
    ['Empty', ['Size0']],
    ['1-50', ['Size49']],
    ['50-200', ['Size199', 'Size50']],
    ['200-1K', ['Size200', 'Size999']],
    ['1K+', ['Size1000']],
  ])('size bucket %s selects exactly the right members at its boundaries', async (label, want) => {
    const uev = userEvent.setup();
    await renderCached(sizeFixtures);
    await openFilters(uev);

    await uev.click(section('Group Size').getByRole('button', { name: label }));
    expect(renderedGroupNames().sort()).toEqual([...want].sort());
  });

  it('push status filter splits pushed from not-pushed', async () => {
    const uev = userEvent.setup();
    await renderCached([
      cachedGroup({
        id: 'a',
        name: 'Pushed',
        pushMappings: [{ mappingId: 'm', appId: 'app1', appName: 'Slack', status: 'ACTIVE' }],
      }),
      cachedGroup({ id: 'b', name: 'NotPushed' }),
      cachedGroup({ id: 'c', name: 'EmptyMappings', pushMappings: [] }),
    ]);
    await openFilters(uev);

    await uev.click(section('Push Status').getByRole('button', { name: 'Pushed' }));
    expect(renderedGroupNames()).toEqual(['Pushed']);

    await uev.click(section('Push Status').getByRole('button', { name: 'Not Pushed' }));
    expect(renderedGroupNames().sort()).toEqual(['EmptyMappings', 'NotPushed']);
  });

  it('push target app filter is a multi-select OR across apps', async () => {
    const uev = userEvent.setup();
    await renderCached([
      cachedGroup({
        id: 'a',
        name: 'SlackOnly',
        pushMappings: [{ mappingId: 'm1', appId: 'app1', appName: 'Slack', status: 'ACTIVE' }],
      }),
      cachedGroup({
        id: 'b',
        name: 'ZoomOnly',
        pushMappings: [{ mappingId: 'm2', appId: 'app2', appName: 'Zoom', status: 'ACTIVE' }],
      }),
      cachedGroup({ id: 'c', name: 'NoPush' }),
    ]);
    await openFilters(uev);
    const apps = section('Push Target App');

    await uev.click(apps.getByRole('button', { name: 'Slack' }));
    expect(renderedGroupNames()).toEqual(['SlackOnly']);

    await uev.click(apps.getByRole('button', { name: 'Zoom' }));
    expect(renderedGroupNames().sort()).toEqual(['SlackOnly', 'ZoomOnly']);

    // Re-clicking an active app deselects it.
    await uev.click(apps.getByRole('button', { name: 'Slack' }));
    expect(renderedGroupNames()).toEqual(['ZoomOnly']);
  });

  it('composes multiple axes conjunctively', async () => {
    const uev = userEvent.setup();
    await renderCached([
      cachedGroup({ id: 'a', name: 'Match', type: 'APP_GROUP', memberCount: 0 }),
      cachedGroup({ id: 'b', name: 'WrongType', type: 'OKTA_GROUP', memberCount: 0 }),
      cachedGroup({ id: 'c', name: 'WrongSize', type: 'APP_GROUP', memberCount: 10 }),
    ]);
    await openFilters(uev);

    await uev.click(section('Group Type').getByRole('button', { name: 'App' }));
    await uev.click(section('Group Size').getByRole('button', { name: 'Empty' }));
    expect(renderedGroupNames()).toEqual(['Match']);
  });

  it('the Filters badge counts the 3 scalar filters plus one for any push-app selection', async () => {
    const uev = userEvent.setup();
    await renderCached([
      cachedGroup({
        id: 'a',
        name: 'A',
        type: 'APP_GROUP',
        pushMappings: [
          { mappingId: 'm1', appId: 'app1', appName: 'Slack', status: 'ACTIVE' },
          { mappingId: 'm2', appId: 'app2', appName: 'Zoom', status: 'ACTIVE' },
        ],
      }),
    ]);
    const badge = () => screen.getByRole('button', { name: /^Filters/ }).textContent;
    await openFilters(uev);

    expect(badge()).toBe('Filters');

    await uev.click(section('Group Type').getByRole('button', { name: 'App' }));
    expect(badge()).toBe('Filters1');

    await uev.click(section('Push Status').getByRole('button', { name: 'Pushed' }));
    expect(badge()).toBe('Filters2');

    // Two apps selected still only add 1 to the count.
    await uev.click(section('Push Target App').getByRole('button', { name: 'Slack' }));
    await uev.click(section('Push Target App').getByRole('button', { name: 'Zoom' }));
    expect(badge()).toBe('Filters3');
  });

  // SURPRISE (pinned as-is): activeFilterCount ignores searchQuery, yet
  // handleClearFilters clears it.
  it('a text query alone does not raise the Filters badge, but Clear all still wipes it', async () => {
    const uev = userEvent.setup();
    await renderCached([cachedGroup({ id: 'a', name: 'Alpha', type: 'APP_GROUP' })]);
    const input = screen.getByPlaceholderText('Search by name, description, ID — or /regex/');

    await uev.type(input, 'alph');
    expect(screen.getByRole('button', { name: /^Filters/ }).textContent).toBe('Filters');

    await openFilters(uev);
    await uev.click(section('Group Type').getByRole('button', { name: 'App' }));
    await uev.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(input).toHaveValue('');
    expect(screen.getByRole('button', { name: /^Filters/ }).textContent).toBe('Filters');
  });

  it('an individual filter chip removes only its own axis', async () => {
    const uev = userEvent.setup();
    await renderCached([
      cachedGroup({ id: 'a', name: 'AppEmpty', type: 'APP_GROUP', memberCount: 0 }),
      cachedGroup({ id: 'b', name: 'AppBig', type: 'APP_GROUP', memberCount: 10 }),
    ]);
    await openFilters(uev);
    await uev.click(section('Group Type').getByRole('button', { name: 'App' }));
    await uev.click(section('Group Size').getByRole('button', { name: 'Empty' }));
    expect(renderedGroupNames()).toEqual(['AppEmpty']);

    const chip = screen.getByText('Size: empty').closest('span') as HTMLElement;
    await uev.click(within(chip).getByRole('button'));

    expect(renderedGroupNames().sort()).toEqual(['AppBig', 'AppEmpty']);
    expect(screen.getByText('Type: APP GROUP')).toBeInTheDocument();
  });
});

// ===========================================================================
// 6. Sorting
// ===========================================================================
describe('sorting (cached mode)', () => {
  const fixtures = [
    cachedGroup({
      id: 'b',
      name: 'Beta',
      memberCount: 5,
      lastUpdated: '2023-01-01T00:00:00.000Z',
    }),
    cachedGroup({
      id: 'a',
      name: 'Alpha',
      memberCount: 99,
      lastUpdated: '2021-01-01T00:00:00.000Z',
    }),
    cachedGroup({
      id: 'c',
      name: 'Gamma',
      memberCount: 1,
      lastUpdated: undefined,
    }),
  ];

  async function open(uev: ReturnType<typeof userEvent.setup>) {
    await uev.click(screen.getByRole('button', { name: /^Filters/ }));
  }
  const sortBtn = (name: string) =>
    section('Sort by').getByRole('button', { name: new RegExp(`^${name}`) });

  it('defaults to name ascending', async () => {
    await renderCached(fixtures);
    expect(renderedGroupNames()).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('re-clicking the active field flips the direction', async () => {
    const uev = userEvent.setup();
    await renderCached(fixtures);
    await open(uev);

    await uev.click(sortBtn('Name'));
    expect(renderedGroupNames()).toEqual(['Gamma', 'Beta', 'Alpha']);

    await uev.click(sortBtn('Name'));
    expect(renderedGroupNames()).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('switching to a numeric field defaults to descending; Name defaults to ascending', async () => {
    const uev = userEvent.setup();
    await renderCached(fixtures);
    await open(uev);

    await uev.click(sortBtn('Size'));
    expect(renderedGroupNames()).toEqual(['Alpha', 'Beta', 'Gamma']); // 99, 5, 1 desc
    await uev.click(sortBtn('Size'));
    expect(renderedGroupNames()).toEqual(['Gamma', 'Beta', 'Alpha']);

    // Back to Name: resets to ascending rather than keeping the desc direction.
    await uev.click(sortBtn('Name'));
    expect(renderedGroupNames()).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('sorts null lastUpdated last in both directions', async () => {
    const uev = userEvent.setup();
    await renderCached(fixtures);
    await open(uev);

    // Default for lastUpdated is desc: newest first, undefined pushed to the end.
    await uev.click(sortBtn('Profile Updated'));
    expect(renderedGroupNames()).toEqual(['Gamma', 'Beta', 'Alpha']);

    // Flipping to asc: the comparator's fixed `cmp = 1` for a missing date gets
    // negated too, so the undefined date leads instead of trailing.
    await uev.click(sortBtn('Profile Updated'));
    expect(renderedGroupNames()).toEqual(['Alpha', 'Beta', 'Gamma']);
  });
});

// ===========================================================================
// 7. Live mode isolation
// ===========================================================================
describe('live mode isolation', () => {
  it('does not render the filter toggle, filter panel, or selection bar', () => {
    render(<GroupsTab targetTabId={1} />);
    expect(screen.queryByRole('button', { name: /^Filters/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Group Type')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Select all/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export list' })).not.toBeInTheDocument();
  });

  it('returns live results in the response order — never filtered or sorted', async () => {
    useDebounceTimers();
    routeSearch(() => ({
      success: true,
      data: [
        rawGroup({ id: 'z', profile: { name: 'Zulu' }, _embedded: { stats: { usersCount: 1 } } }),
        rawGroup({ id: 'a', profile: { name: 'Alpha' }, _embedded: { stats: { usersCount: 99 } } }),
        rawGroup({ id: 'm', profile: { name: 'Mike' }, _embedded: { stats: { usersCount: 50 } } }),
      ],
    }));

    render(<GroupsTab targetTabId={1} />);
    typeInto(liveInput(), 'x');
    await advance(300);

    // Neither name-ascending (the default sort) nor any size order — response order.
    expect(renderedGroupNames()).toEqual(['Zulu', 'Alpha', 'Mike']);
  });
});

// ===========================================================================
// 8. Selection
// ===========================================================================
describe('selection', () => {
  const fixtures = [
    cachedGroup({ id: 'a', name: 'AppOne', type: 'APP_GROUP' }),
    cachedGroup({ id: 'b', name: 'OktaOne', type: 'OKTA_GROUP' }),
    cachedGroup({ id: 'c', name: 'OktaTwo', type: 'OKTA_GROUP' }),
  ];

  it('survives filtering: the bar counts selected-vs-filtered and hidden picks stay selected', async () => {
    const uev = userEvent.setup();
    await renderCached(fixtures);

    for (const name of ['AppOne', 'OktaOne', 'OktaTwo']) {
      await uev.click(screen.getByRole('checkbox', { name: `Select ${name}` }));
    }
    // RETARGETED: `GroupsListActionBar` replaced the `N of M selected` readout —
    // the selected count is the header badge, and the filtered denominator rides
    // `Select all (M)`, which stays visible (disabled) once everything is taken
    // precisely so the count survives. Same two numbers, same assertion.
    expect(screen.getByRole('button', { name: 'Select all (3)' })).toBeInTheDocument();
    expect(screen.getByText('3 Selected')).toBeInTheDocument();

    await uev.click(screen.getByRole('button', { name: /^Filters/ }));
    await uev.click(section('Group Type').getByRole('button', { name: 'App' }));

    expect(renderedGroupNames()).toEqual(['AppOne']);
    expect(screen.getByRole('button', { name: 'Select all (1)' })).toBeInTheDocument();
    expect(screen.getByText('3 Selected')).toBeInTheDocument();

    // Export uses `groups`, not `filteredGroups` — all three, including the hidden ones.
    await uev.click(screen.getByRole('button', { name: /Export \(3\)/ }));
    expect(
      screen
        .getAllByTestId('export-modal-group')
        .map((n) => n.textContent)
        .sort(),
    ).toEqual(['AppOne', 'OktaOne', 'OktaTwo']);
  });

  it('survives a reload of the group list', async () => {
    const uev = userEvent.setup();
    routeSiblingCollections();
    route(/^\/api\/v1\/groups\?limit=200&expand=stats&expand=app$/, () => ({
      success: true,
      headers: {},
      data: [
        rawGroup({ id: 'a', profile: { name: 'AppOne' } }),
        rawGroup({ id: 'b', profile: { name: 'OktaOne' } }),
      ],
    }));
    await renderCached([
      cachedGroup({ id: 'a', name: 'AppOne' }),
      cachedGroup({ id: 'b', name: 'OktaOne' }),
    ]);

    await uev.click(screen.getByRole('checkbox', { name: 'Select AppOne' }));
    expect(screen.getByText('1 Selected')).toBeInTheDocument();

    // Refresh replaces `groups` wholesale; the selection is never pruned.
    await uev.click(screen.getByRole('button', { name: /Refresh/ }));

    // RETARGETED (ADR-0040): the reload's durable trace is the snapshot's walk
    // mark, not a `chrome.storage.local` write. Seeded at 1, so a real walk
    // moves it forward.
    await waitFor(() =>
      expect(idbTables.get('syncMeta')!.get(`${ORIGIN}::groups`).lastFullWalkAt).toBeGreaterThan(1),
    );
    expect(screen.getByText('1 Selected')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select AppOne' })).toBeChecked();
  });

  it('Select all selects only the filtered groups; Deselect clears everything', async () => {
    const uev = userEvent.setup();
    await renderCached(fixtures);
    await uev.click(screen.getByRole('button', { name: /^Filters/ }));
    await uev.click(section('Group Type').getByRole('button', { name: 'Okta' }));

    await uev.click(screen.getByRole('button', { name: 'Select all (2)' }));
    expect(screen.getByText('2 Selected')).toBeInTheDocument();

    await uev.click(section('Group Type').getByRole('button', { name: 'All' }));
    expect(screen.getByRole('button', { name: 'Select all (3)' })).toBeInTheDocument();
    expect(screen.getByText('2 Selected')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select AppOne' })).not.toBeChecked();

    await uev.click(screen.getByRole('button', { name: 'Deselect all' }));
    expect(screen.queryByText(/\d+ Selected/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select all (3)' })).toBeEnabled();
  });

  it('loading a collection replaces the selection wholesale', async () => {
    const uev = userEvent.setup();
    await renderCached(fixtures);
    await uev.click(screen.getByRole('checkbox', { name: 'Select AppOne' }));
    await uev.click(screen.getByRole('button', { name: /Collections/ }));

    act(() => captured.props.GroupCollections.onLoadCollection(['b', 'c']));

    expect(screen.getByRole('checkbox', { name: 'Select AppOne' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select OktaOne' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select OktaTwo' })).toBeChecked();
  });

  it('shows Compare only for 2-5 selections and Bulk actions only above 0', async () => {
    const uev = userEvent.setup();
    await renderCached(fixtures);
    const compare = () => screen.queryByRole('button', { name: /^Compare/ });

    expect(compare()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bulk actions' })).not.toBeInTheDocument();

    await uev.click(screen.getByRole('checkbox', { name: 'Select AppOne' }));
    expect(compare()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bulk actions' })).toBeInTheDocument();

    await uev.click(screen.getByRole('checkbox', { name: 'Select OktaOne' }));
    expect(compare()).toHaveTextContent('Compare (2)');
  });
});

// ===========================================================================
// 9. Export list CSV — pin the current bytes before any csvUtils swap.
// ===========================================================================
describe('Export list CSV', () => {
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let blobs: Array<{ text: string; type: string | undefined }>;
  const RealBlob = globalThis.Blob;

  beforeEach(() => {
    blobs = [];
    // jsdom's Blob has no .text(); capture the constructor args instead.
    globalThis.Blob = class extends RealBlob {
      constructor(parts: any[], options?: BlobPropertyBag) {
        super(parts, options);
        blobs.push({ text: parts.join(''), type: options?.type });
      }
    } as any;
    revokeObjectURL = vi.fn();
    (globalThis.URL as any).createObjectURL = vi.fn(() => 'blob:mock-url');
    (globalThis.URL as any).revokeObjectURL = revokeObjectURL;
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.Blob = RealBlob;
    clickSpy.mockRestore();
  });

  it('emits an unconditionally-quoted CSV of the filtered list with the expected header', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-14T12:00:00.000Z'));
    const uev = userEvent.setup();
    await renderCached([
      cachedGroup({
        id: 'a',
        name: 'Say "hi"',
        description: 'has, comma',
        type: 'OKTA_GROUP',
        memberCount: 7,
        pushMappings: [{ mappingId: 'm', appId: 'app1', appName: 'Slack', status: 'ACTIVE' }],
      }),
      cachedGroup({
        id: 'b',
        name: 'Plain',
        description: undefined,
        memberCount: 0,
      }),
    ]);

    await uev.click(screen.getByRole('button', { name: 'Export list' }));

    expect(blobs).toHaveLength(1);
    expect(blobs[0].type).toBe('text/csv');
    // Rows follow filteredGroups, i.e. the CURRENT sort (name ascending by default),
    // not the underlying cache order.
    expect(blobs[0].text.split('\n')).toEqual([
      '"ID","Name","Description","Type","Member Count","Push Status"',
      '"b","Plain","","OKTA_GROUP","0","Not Pushed"',
      '"a","Say ""hi""","has, comma","OKTA_GROUP","7","Pushed (1)"',
    ]);

    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('okta_groups_2026-07-14.csv');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    vi.useRealTimers();
  });

  it('exports the filtered subset, not the whole cache, and disables at zero rows', async () => {
    const uev = userEvent.setup();
    await renderCached([
      cachedGroup({ id: 'a', name: 'AppOne', type: 'APP_GROUP' }),
      cachedGroup({ id: 'b', name: 'OktaOne', type: 'OKTA_GROUP' }),
    ]);
    await uev.click(screen.getByRole('button', { name: /^Filters/ }));
    await uev.click(section('Group Type').getByRole('button', { name: 'App' }));

    await uev.click(screen.getByRole('button', { name: 'Export list' }));
    expect(blobs[0].text).toContain('"AppOne"');
    expect(blobs[0].text).not.toContain('"OktaOne"');

    await uev.click(section('Group Type').getByRole('button', { name: 'Built-in' }));
    expect(screen.getByRole('button', { name: 'Export list' })).toBeDisabled();
  });
});

// ===========================================================================
// 10. Prop brokering: identity stability, always-mounted modals, snapshots
// ===========================================================================
describe('prop brokering', () => {
  it('keeps both modals mounted with isOpen=false on first render', async () => {
    await renderCached([cachedGroup()]);
    expect(screen.getByTestId('export-modal')).toHaveAttribute('data-open', 'false');
    expect(screen.getByTestId('comparison-modal')).toHaveAttribute('data-open', 'false');
  });

  it('keeps onFetchMembers and onToggleSelect Object.is-stable across re-renders', async () => {
    const uev = userEvent.setup();
    const { rerender } = await renderCached([cachedGroup({ id: 'a', name: 'Alpha' })]);
    const fetchMembers = captured.props.GroupExportModal.onFetchMembers;

    // Churn a genuinely inert prop rather than `oktaOrigin`, which the earlier
    // version varied. The snapshot is scoped by origin (ADR-0040), so changing it
    // now means changing org — which correctly blanks the list, and would make
    // this assert identity stability across a list that no longer has Alpha in it.
    for (let i = 0; i < 3; i++) {
      rerender(
        <GroupsTab
          targetTabId={1}
          oktaOrigin={ORIGIN}
          onNavigateToRule={() => {
            void i;
          }}
        />,
      );
    }
    // A state change that re-renders the whole tab, too.
    await uev.click(screen.getByRole('checkbox', { name: 'Select Alpha' }));

    expect(Object.is(captured.props.GroupExportModal.onFetchMembers, fetchMembers)).toBe(true);
  });

  it('keeps onRemoveUserFromGroups Object.is-stable across re-renders', async () => {
    const uev = userEvent.setup();
    await renderCached([cachedGroup({ id: 'a', name: 'Alpha' })]);
    await uev.click(screen.getByRole('button', { name: /^Cross-search/ }));
    const remove = captured.props.CrossGroupSearch.onRemoveUserFromGroups;

    await uev.click(screen.getByRole('checkbox', { name: 'Select Alpha' }));

    expect(Object.is(captured.props.CrossGroupSearch.onRemoveUserFromGroups, remove)).toBe(true);
  });

  // The apiRef is assigned during render precisely so callbacks memoized on []
  // still see the CURRENT targetTabId rather than a one-commit-stale one.
  it('onFetchMembers uses the current targetTabId even though it is memoized on []', async () => {
    route(/^\/api\/v1\/groups\/g1\/users\?limit=200&expand=group-rules$/, () => ({
      success: true,
      headers: {},
      data: [user('u1')],
    }));
    const { rerender } = render(<GroupsTab targetTabId={null} />);
    const fetchMembers = captured.props.GroupExportModal.onFetchMembers;

    rerender(<GroupsTab targetTabId={5} />);
    expect(Object.is(captured.props.GroupExportModal.onFetchMembers, fetchMembers)).toBe(true);

    await act(async () => {
      await captured.props.GroupExportModal.onFetchMembers('g1');
    });

    expect(runtimeSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/v1/groups/g1/users?limit=200&expand=group-rules',
        tabId: 5,
      }),
    );
  });

  it('freezes the export modal group list at click time', async () => {
    const uev = userEvent.setup();
    await renderCached([
      cachedGroup({ id: 'a', name: 'Alpha' }),
      cachedGroup({ id: 'b', name: 'Beta' }),
      cachedGroup({ id: 'c', name: 'Gamma' }),
    ]);
    await uev.click(screen.getByRole('checkbox', { name: 'Select Alpha' }));
    await uev.click(screen.getByRole('checkbox', { name: 'Select Beta' }));
    await uev.click(screen.getByRole('button', { name: /Export \(2\)/ }));

    expect(screen.getAllByTestId('export-modal-group')).toHaveLength(2);

    // Change the selection WITHOUT closing the modal.
    await uev.click(screen.getByRole('checkbox', { name: 'Select Gamma' }));

    expect(screen.getByTestId('export-modal')).toHaveAttribute('data-open', 'true');
    expect(screen.getAllByTestId('export-modal-group').map((n) => n.textContent)).toEqual([
      'Alpha',
      'Beta',
    ]);
  });

  it('feeds the comparison modal the LIVE selection (unlike export)', async () => {
    const uev = userEvent.setup();
    await renderCached([
      cachedGroup({ id: 'a', name: 'Alpha' }),
      cachedGroup({ id: 'b', name: 'Beta' }),
    ]);
    await uev.click(screen.getByRole('checkbox', { name: 'Select Alpha' }));
    await uev.click(screen.getByRole('checkbox', { name: 'Select Beta' }));
    await uev.click(screen.getByRole('button', { name: /^Compare/ }));
    expect(captured.props.GroupComparisonModal.groups).toHaveLength(2);

    await uev.click(screen.getByRole('checkbox', { name: 'Select Beta' }));

    expect(screen.getByTestId('comparison-modal')).toHaveAttribute('data-open', 'true');
    expect(captured.props.GroupComparisonModal.groups.map((g: any) => g.name)).toEqual(['Alpha']);
  });
});

// ===========================================================================
// 11. The shared member cache Map + compareGroups' in-place mutation
// ===========================================================================
describe('groupMembersCache', () => {
  it('onFetchMembers populates the cache immutably and the Cross-search count reflects it', async () => {
    route(/^\/api\/v1\/groups\/a\/users\?limit=200&expand=group-rules$/, () => ({
      success: true,
      headers: {},
      data: [user('u1')],
    }));
    await renderCached([cachedGroup({ id: 'a', name: 'Alpha' })]);
    // RETARGETED: an `ActionDescriptor` carries no JSX, so the cached-members
    // count is part of the label rather than a `Button` badge element.
    const crossSearch = () => screen.getByRole('button', { name: /Cross-search/ }).textContent;

    expect(crossSearch()).toBe('Cross-search');

    await act(async () => {
      await captured.props.GroupExportModal.onFetchMembers('a');
    });

    expect(crossSearch()).toBe('Cross-search (1)');
  });

  // SURPRISE (pinned as-is): api.compareGroups writes straight into the state Map
  // (groupAnalysis.ts `memberCache?.set(...)`) with no setState. The caching works
  // (no refetch), but the badge does not update until something else re-renders.
  it('compareGroups mutates the cache Map in place: no refetch, and no badge update', async () => {
    const uev = userEvent.setup();
    let memberFetches = 0;
    route(/^\/api\/v1\/groups\/[ab]\/users\?limit=200&expand=group-rules$/, () => {
      memberFetches++;
      return { success: true, headers: {}, data: [user('u1'), user('u2')] };
    });
    await renderCached([
      cachedGroup({ id: 'a', name: 'Alpha' }),
      cachedGroup({ id: 'b', name: 'Beta' }),
    ]);
    await uev.click(screen.getByRole('checkbox', { name: 'Select Alpha' }));
    await uev.click(screen.getByRole('checkbox', { name: 'Select Beta' }));

    const runCompare = async () => {
      const p = captured.props.GroupComparisonModal;
      await act(async () => {
        await p.compareGroups(
          p.groups.map((g: any) => ({ id: g.id, name: g.name })),
          undefined,
          p.memberCache,
        );
      });
    };

    await runCompare();
    expect(memberFetches).toBe(2);

    // Half 1: the mutation really did populate the cache — no refetch on re-open.
    await runCompare();
    expect(memberFetches).toBe(2);

    // Half 2: ...but React never learned about it, so the badge is still absent.
    expect(screen.getByRole('button', { name: /Cross-search/ }).textContent).toBe('Cross-search');
  });

  it('passes the raw (uncloned) cache Map to both the comparison modal and cross-search', async () => {
    const uev = userEvent.setup();
    await renderCached([cachedGroup({ id: 'a', name: 'Alpha' })]);
    await uev.click(screen.getByRole('button', { name: /^Cross-search/ }));

    expect(
      Object.is(
        captured.props.GroupComparisonModal.memberCache,
        captured.props.CrossGroupSearch.groupMembersCache,
      ),
    ).toBe(true);
  });

  it('builds groupNames from every cached group, not just the selected ones', async () => {
    const uev = userEvent.setup();
    await renderCached([
      cachedGroup({ id: 'a', name: 'Alpha' }),
      cachedGroup({ id: 'b', name: 'Beta' }),
    ]);
    await uev.click(screen.getByRole('checkbox', { name: 'Select Alpha' }));
    await uev.click(screen.getByRole('button', { name: /^Cross-search/ }));

    expect([...captured.props.CrossGroupSearch.groupNames.entries()]).toEqual([
      ['a', 'Alpha'],
      ['b', 'Beta'],
    ]);
  });
});

// ===========================================================================
// 12. handleRemoveUserFromGroups sequencing
// ===========================================================================
describe('handleRemoveUserFromGroups', () => {
  async function openCrossSearch() {
    const uev = userEvent.setup();
    await renderCached([cachedGroup({ id: 'a', name: 'Alpha' })]);
    await uev.click(screen.getByRole('button', { name: /^Cross-search/ }));
    return captured.props.CrossGroupSearch.onRemoveUserFromGroups;
  }

  it('issues one DELETE per group, sequentially, in the given order', async () => {
    const order: string[] = [];
    route(/^\/api\/v1\/groups\/.*\/users\/u1$/, (msg) => {
      order.push(msg.endpoint);
      return { success: true };
    });
    const remove = await openCrossSearch();

    await act(async () => {
      await remove('u1', ['g1', 'g2', 'g3']);
    });

    expect(order).toEqual([
      '/api/v1/groups/g1/users/u1',
      '/api/v1/groups/g2/users/u1',
      '/api/v1/groups/g3/users/u1',
    ]);
    expect(schedulerCalls().every((m) => m.method === 'DELETE' || m.method === 'GET')).toBe(true);
  });

  it('aborts the remaining groups when a DELETE rejects, and propagates', async () => {
    const attempted: string[] = [];
    route(/^\/api\/v1\/groups\/.*\/users\/u1$/, (msg) => {
      attempted.push(msg.endpoint);
      if (msg.endpoint.includes('/g2/')) throw new Error('boom');
      return { success: true };
    });
    const remove = await openCrossSearch();

    await expect(remove('u1', ['g1', 'g2', 'g3'])).rejects.toThrow('boom');
    expect(attempted).toEqual(['/api/v1/groups/g1/users/u1', '/api/v1/groups/g2/users/u1']);
  });

  // SURPRISE (pinned as-is): RequestResult.success is ignored, so a non-throwing
  // failure is treated as a success and the loop carries on.
  it('treats a success:false response as a success and keeps going', async () => {
    const attempted: string[] = [];
    route(/^\/api\/v1\/groups\/.*\/users\/u1$/, (msg) => {
      attempted.push(msg.endpoint);
      return { success: false, error: 'nope' };
    });
    const remove = await openCrossSearch();

    await act(async () => {
      await expect(remove('u1', ['g1', 'g2'])).resolves.toBeUndefined();
    });
    expect(attempted).toHaveLength(2);
  });
});

// ===========================================================================
// 13. Panels
// ===========================================================================
describe('inline panels', () => {
  const fixtures = [cachedGroup({ id: 'a', name: 'Alpha' })];

  it('are mutually exclusive and toggle off on a second click', async () => {
    const uev = userEvent.setup();
    await renderCached(fixtures);

    await uev.click(screen.getByRole('button', { name: /^Cross-search/ }));
    expect(screen.getByTestId('cross-group-search')).toBeInTheDocument();

    await uev.click(screen.getByRole('button', { name: /Collections/ }));
    expect(screen.queryByTestId('cross-group-search')).not.toBeInTheDocument();
    expect(screen.getByTestId('collections-panel')).toBeInTheDocument();

    await uev.click(screen.getByRole('button', { name: /Collections/ }));
    expect(screen.queryByTestId('collections-panel')).not.toBeInTheDocument();
  });

  it('closes via the child onClose callback', async () => {
    const uev = userEvent.setup();
    await renderCached(fixtures);
    await uev.click(screen.getByRole('button', { name: /^Cross-search/ }));

    act(() => captured.props.CrossGroupSearch.onClose());

    expect(screen.queryByTestId('cross-group-search')).not.toBeInTheDocument();
  });

  it('drops the bulk panel the moment the selection empties', async () => {
    const uev = userEvent.setup();
    await renderCached(fixtures);
    await uev.click(screen.getByRole('checkbox', { name: 'Select Alpha' }));
    await uev.click(screen.getByRole('button', { name: 'Bulk actions' }));
    expect(screen.getByTestId('bulk-panel')).toBeInTheDocument();

    await uev.click(screen.getByRole('button', { name: 'Deselect all' }));

    expect(screen.queryByTestId('bulk-panel')).not.toBeInTheDocument();
  });

  it('lets the bulk panel trigger the export modal', async () => {
    const uev = userEvent.setup();
    await renderCached(fixtures);
    await uev.click(screen.getByRole('checkbox', { name: 'Select Alpha' }));
    await uev.click(screen.getByRole('button', { name: 'Bulk actions' }));

    await act(async () => captured.props.BulkOperationsPanel.onExportSelection());

    expect(screen.getByTestId('export-modal')).toHaveAttribute('data-open', 'true');
  });
});

// ===========================================================================
// 14. Empty states
// ===========================================================================
describe('empty states', () => {
  it('live + query + not searching: offers Load All Groups', async () => {
    useDebounceTimers();
    routeSearch(() => ({ success: true, data: [] }));

    render(<GroupsTab targetTabId={1} />);
    typeInto(liveInput(), 'zzz');
    await advance(300);

    expect(screen.getByText('No groups found matching "zzz"')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Load All Groups' })).toHaveLength(2);
  });

  it('live with no query: renders no empty state at all', () => {
    render(<GroupsTab targetTabId={1} />);
    expect(screen.queryByText(/No groups/)).not.toBeInTheDocument();
  });

  it('live while searching: suppresses the empty state', async () => {
    useDebounceTimers();
    const pending = deferred<any>();
    routeSearch(() => pending.promise);

    render(<GroupsTab targetTabId={1} />);
    typeInto(liveInput(), 'zzz');
    await advance(300);

    expect(screen.queryByText('No groups found matching "zzz"')).not.toBeInTheDocument();

    await act(async () => {
      pending.resolve({ success: true, data: [] });
      await Promise.resolve();
    });
    expect(screen.getByText('No groups found matching "zzz"')).toBeInTheDocument();
  });

  it('cached with groups but none matching: Clear Filters appears only when a scalar filter is set', async () => {
    const uev = userEvent.setup();
    await renderCached([cachedGroup({ id: 'a', name: 'Alpha', type: 'OKTA_GROUP' })]);

    // A text query alone yields the empty state but NO Clear Filters action
    // (activeFilterCount ignores searchQuery).
    await uev.type(
      screen.getByPlaceholderText('Search by name, description, ID — or /regex/'),
      'zzz',
    );
    expect(screen.getByText('No groups match your filters')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear Filters' })).not.toBeInTheDocument();

    await uev.click(screen.getByRole('button', { name: /^Filters/ }));
    await uev.click(section('Group Type').getByRole('button', { name: 'App' }));
    expect(screen.getByRole('button', { name: 'Clear Filters' })).toBeInTheDocument();

    await uev.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(renderedGroupNames()).toEqual(['Alpha']);
  });

  it('cached with an empty cache: renders no empty state', async () => {
    await renderCached([]);
    expect(screen.queryByText(/No groups/)).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 15. PageHeader badge + actions
// ===========================================================================
describe('page header', () => {
  it('prefers the selection badge over the cached-count badge', async () => {
    const uev = userEvent.setup();
    await renderCached([cachedGroup({ id: 'a', name: 'Alpha' })]);
    expect(screen.getByText('1 Cached')).toBeInTheDocument();

    await uev.click(screen.getByRole('checkbox', { name: 'Select Alpha' }));

    expect(screen.getByText('1 Selected')).toBeInTheDocument();
    expect(screen.queryByText('1 Cached')).not.toBeInTheDocument();
  });

  it('shows the Live badge in live mode', () => {
    render(<GroupsTab targetTabId={1} />);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('disables Load All Groups without a target tab', () => {
    render(<GroupsTab targetTabId={null} />);
    expect(screen.getByRole('button', { name: 'Load All Groups' })).toBeDisabled();
  });

  it('disables Load All Groups while loading, and shows the list spinner', async () => {
    const uev = userEvent.setup();
    const pending = deferred<any>();
    routeSiblingCollections();
    route(/^\/api\/v1\/groups\?limit=200&expand=stats&expand=app$/, () => pending.promise);

    render(<GroupsTab targetTabId={1} oktaOrigin={ORIGIN} />);
    await uev.click(screen.getByRole('button', { name: 'Load All Groups' }));

    expect(screen.getByRole('button', { name: 'Load All Groups' })).toBeDisabled();
    expect(screen.getByText('Loading groups from Okta...')).toBeInTheDocument();

    await act(async () => {
      pending.resolve({ success: true, headers: {}, data: [] });
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(screen.queryByText('Loading groups from Okta...')).not.toBeInTheDocument(),
    );
  });
});

describe('deep-link from the Rules tab', () => {
  it('highlights and auto-expands the navigated group row', async () => {
    await renderCached(
      [cachedGroup({ id: 'g1', name: 'Engineering' }), cachedGroup({ id: 'g2', name: 'Sales' })],
      { selectedGroupId: 'g1', onGroupSelected: () => {} },
    );
    await waitFor(() => expect(screen.getByText('Engineering')).toBeInTheDocument());
    // The highlighted group auto-expands, revealing its detail; others stay collapsed.
    await waitFor(() => expect(screen.getByText('Group ID')).toBeInTheDocument());
    expect(screen.getAllByText('Group ID')).toHaveLength(1);
  });

  it('loads the group list on demand when the target is not cached, then highlights it', async () => {
    // Live mode, nothing loaded. A deep-link for g1 must trigger a cached load
    // itself rather than sit inert waiting for a manual "Load All Groups".
    routeSiblingCollections();
    route(/^\/api\/v1\/groups\?limit=200&expand=stats&expand=app$/, () => ({
      success: true,
      headers: {},
      data: [
        rawGroup({ id: 'g1', profile: { name: 'Engineering' } }),
        rawGroup({ id: 'g2', profile: { name: 'Sales' } }),
      ],
    }));

    render(
      <GroupsTab
        targetTabId={1}
        oktaOrigin={ORIGIN}
        selectedGroupId="g1"
        onGroupSelected={() => {}}
      />,
    );

    // The list loaded itself (no manual click) and the target appears...
    await waitFor(() => expect(renderedGroupNames()).toContain('Engineering'));
    // Exactly one walk, not one per render — the deep-link must not re-ask.
    expect(
      walkCalls.filter((e) => /^\/api\/v1\/groups\?limit=200&expand=stats&expand=app$/.test(e)),
    ).toHaveLength(1);
    // ...auto-expanded because it is the highlighted deep-link target.
    await waitFor(() => expect(screen.getByText('Group ID')).toBeInTheDocument());
    expect(screen.getAllByText('Group ID')).toHaveLength(1);
  });
});

describe('a filtered view requested from Home', () => {
  it('applies the one filter, clears the rest, and leaves the panel closed', async () => {
    const onListViewConsumed = vi.fn();
    await renderCached(
      [
        cachedGroup({ id: 'a', name: 'Empty one', memberCount: 0 }),
        cachedGroup({ id: 'b', name: 'Populated', memberCount: 12 }),
      ],
      { listView: 'empty', onListViewConsumed },
    );

    await waitFor(() => expect(renderedGroupNames()).toEqual(['Empty one']));
    // The badge on the collapsed toggle is what explains the short list. The
    // panel itself stays shut: a reader who pressed a finding on Home asked for
    // the list, not for the controls that produced it.
    expect(screen.getByRole('button', { name: /^Filters/ }).textContent).toBe('Filters1');
    expect(screen.queryByText('Sort by')).not.toBeInTheDocument();
    expect(onListViewConsumed).toHaveBeenCalledTimes(1);
  });

  it('switches to cached mode, so a local filter has rows to apply to', async () => {
    // The live search returns Okta's matches for a query and no local filter
    // applies to them, so arriving in live mode would show the whole list.
    await renderCached([cachedGroup({ id: 'a', name: 'Empty one', memberCount: 0 })], {
      listView: 'no-rules',
      onListViewConsumed: () => {},
    });
    await waitFor(() => expect(screen.getByText('1 Cached')).toBeInTheDocument());
  });
});
