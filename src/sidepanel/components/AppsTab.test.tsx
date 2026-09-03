/**
 * Unit tests for the READ-ONLY Applications tab.
 *
 * The `useOktaApi` facade is mocked (as `overview/GroupOverview.test.tsx` does) so
 * these assertions target AppsTab's own orchestration — the auto-load, the search
 * and status filtering, the error banner, and the two empty states — rather than
 * the scheduler transport, which `useOktaApi/appOperations.test.ts` already covers.
 *
 * RETARGETED for ADR-0040: the inventory now arrives from the background-owned
 * org snapshot rather than from `getAllApps`, so the seam these drive is the
 * `syncSnapshot` message and the IndexedDB store. Every assertion about what the
 * tab *does* with an inventory — filter it, empty-state it, banner a failure —
 * is unchanged.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppsTab from './AppsTab';
import type { OktaAppListItem } from '../../shared/schemas/okta';

const api = vi.hoisted(() => ({
  getAppAssignmentCounts: vi.fn(),
  isLoading: false,
}));

vi.mock('../hooks/useOktaApi', () => ({
  useOktaApi: () => api,
}));

// ---------------------------------------------------------------------------
// IndexedDB fake
// ---------------------------------------------------------------------------
// jsdom has no IndexedDB and `fake-indexeddb` is not a dependency, so `idb` is
// faked with a Map, as `shared/snapshot/orgSnapshotStore.test.ts` does.
const { fakeDB, idbTables } = vi.hoisted(() => {
  const idbTables = new Map<string, Map<string, any>>();
  const keyOf = (key: unknown) => (Array.isArray(key) ? key.join('::') : String(key));
  const table = (name: string) => {
    if (!idbTables.has(name)) idbTables.set(name, new Map());
    return idbTables.get(name)!;
  };
  const fakeDB = {
    get: async (name: string, key: unknown) => table(name).get(keyOf(key)),
    put: async () => {},
    delete: async () => {},
    getAllFromIndex: async (name: string, _i: string, origin: string) =>
      [...table(name).values()].filter((v) => v.origin === origin),
    getAllKeysFromIndex: async () => [],
    transaction: () => ({
      store: { put: async () => {}, delete: async () => {} },
      done: Promise.resolve(),
    }),
  };
  return { fakeDB, idbTables };
});

vi.mock('idb', () => ({ openDB: vi.fn(async () => fakeDB) }));

/** The org every render targets; the snapshot is scoped by origin. */
const ORIGIN = 'https://example.okta.com';

const sendMessage = vi.fn();

globalThis.chrome = {
  runtime: {
    sendMessage,
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  },
} as unknown as typeof chrome;

/** Write app rows into the snapshot, as a completed background walk would. */
function seedApps(apps: OktaAppListItem[], origin = ORIGIN) {
  const table = new Map<string, any>();
  for (const entity of apps) {
    table.set(`${origin}::${entity.id}`, { origin, id: entity.id, entity, syncedAt: 1 });
  }
  idbTables.set('apps', table);
  idbTables.set(
    'syncMeta',
    new Map([
      [
        `${origin}::apps`,
        {
          origin,
          collection: 'apps',
          complete: true,
          lastFullWalkAt: 1,
          lastDeltaAt: null,
          watermark: null,
          itemCount: apps.length,
          cursor: null,
          walkStartedAt: null,
          deltaSupported: null,
        },
      ],
    ]),
  );
}

/** The `syncSnapshot` messages the panel sent to the background. */
function syncCalls() {
  return sendMessage.mock.calls
    .map((call) => call[0])
    .filter((msg) => msg?.action === 'syncSnapshot');
}

const SAMPLE_APPS: OktaAppListItem[] = [
  {
    id: '0oaFAKE0001',
    name: 'salesforce',
    label: 'Salesforce',
    status: 'ACTIVE',
    signOnMode: 'SAML_2_0',
    created: '2026-01-15T00:00:00.000Z',
  },
  {
    id: '0oaFAKE0002',
    name: 'workday',
    label: 'Workday HR',
    status: 'INACTIVE',
    signOnMode: 'SAML_2_0',
    created: '2026-03-01T00:00:00.000Z',
  },
] as OktaAppListItem[];

beforeEach(() => {
  vi.clearAllMocks();
  idbTables.clear();
  api.getAppAssignmentCounts.mockResolvedValue({ users: 12, groups: 3 });
  // The background's default: a walk that succeeds and fills the store.
  sendMessage.mockImplementation(async (msg: { action?: string; origin?: string }) => {
    if (msg?.action !== 'syncSnapshot') return undefined;
    seedApps(SAMPLE_APPS, msg.origin);
    return { success: true };
  });
});

/** Resolve a never-settling promise on demand, to observe the loading state. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('AppsTab', () => {
  it('shows the loading state, then renders the loaded apps', async () => {
    const gate = deferred<{ success: boolean }>();
    sendMessage.mockReturnValue(gate.promise);

    render(<AppsTab targetTabId={1} oktaOrigin={ORIGIN} />);

    expect(await screen.findByText('Loading applications from Okta...')).toBeInTheDocument();

    seedApps(SAMPLE_APPS);
    gate.resolve({ success: true });

    expect(await screen.findByText('Salesforce')).toBeInTheDocument();
    expect(screen.getByText('Workday HR')).toBeInTheDocument();
    expect(syncCalls()).toHaveLength(1);
  });

  it('filters the list by the search query', async () => {
    const user = userEvent.setup();
    render(<AppsTab targetTabId={1} oktaOrigin={ORIGIN} />);

    expect(await screen.findByText('Salesforce')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search applications'), 'workday');

    await waitFor(() => expect(screen.queryByText('Salesforce')).not.toBeInTheDocument());
    expect(screen.getByText('Workday HR')).toBeInTheDocument();
  });

  it('filters the list by the status bucket', async () => {
    const user = userEvent.setup();
    render(<AppsTab targetTabId={1} oktaOrigin={ORIGIN} />);

    expect(await screen.findByText('Salesforce')).toBeInTheDocument();

    const statusGroup = screen.getByRole('group', { name: 'Filter by status' });
    await user.click(within(statusGroup).getByRole('button', { name: 'Inactive' }));

    await waitFor(() => expect(screen.queryByText('Salesforce')).not.toBeInTheDocument());
    expect(screen.getByText('Workday HR')).toBeInTheDocument();
  });

  it('shows the no-matches empty state and clears the filters', async () => {
    const user = userEvent.setup();
    render(<AppsTab targetTabId={1} oktaOrigin={ORIGIN} />);

    expect(await screen.findByText('Salesforce')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search applications'), 'nothing-matches-this');

    expect(await screen.findByText('No applications match your filters')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText('Salesforce')).toBeInTheDocument();
  });

  it('shows the nothing-loaded empty state for an org with no apps', async () => {
    sendMessage.mockResolvedValue({ success: true });

    render(<AppsTab targetTabId={1} oktaOrigin={ORIGIN} />);

    expect(await screen.findByText('No applications loaded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load applications' })).toBeInTheDocument();
  });

  it('banners a load failure as a dismissible danger alert', async () => {
    const user = userEvent.setup();
    sendMessage.mockResolvedValue({ success: false, error: 'Failed to fetch apps' });

    render(<AppsTab targetTabId={1} oktaOrigin={ORIGIN} />);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Failed to fetch apps')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('does not load when no Okta tab is connected', async () => {
    render(<AppsTab targetTabId={null} oktaOrigin={ORIGIN} />);

    expect(await screen.findByText('No applications loaded')).toBeInTheDocument();
    expect(syncCalls()).toHaveLength(0);

    // Retargeted from the header's Refresh button, which ADR-0069 §4 moved into
    // the app-level control in the top chrome. The behaviour it pinned — no tab,
    // no request — is unchanged and now belongs to the empty state's own load
    // prompt, which is the only load affordance left on this rung.
    await userEvent.setup().click(screen.getByRole('button', { name: 'Load applications' }));
    expect(syncCalls()).toHaveLength(0);
  });

  it('arrives at a deep-linked app with the list filtered to it, once', async () => {
    const onAppSelected = vi.fn();
    const { rerender } = render(
      <AppsTab
        targetTabId={1}
        oktaOrigin={ORIGIN}
        selectedAppId="0oaFAKE0002"
        onAppSelected={onAppSelected}
      />,
    );

    // The filter is the visible search box, so the reader can see why the list
    // narrowed and can widen it — an id in a name filter would match nothing.
    expect(await screen.findByText('Workday HR')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Salesforce')).not.toBeInTheDocument());
    expect(screen.getByDisplayValue('Workday HR')).toBeInTheDocument();
    await waitFor(() => expect(onAppSelected).toHaveBeenCalledTimes(1));

    // One-shot: a re-render with the same id must not re-apply the filter over
    // whatever the reader has typed since.
    rerender(
      <AppsTab
        targetTabId={1}
        oktaOrigin={ORIGIN}
        selectedAppId="0oaFAKE0002"
        onAppSelected={onAppSelected}
      />,
    );
    expect(onAppSelected).toHaveBeenCalledTimes(1);
  });

  it('leaves the list alone when the deep-linked app is not in the inventory', async () => {
    // The inventory is the org snapshot, which may still be walking. Filtering
    // to empty would state an absence the snapshot cannot support (ADR-0040 §7).
    const onAppSelected = vi.fn();
    render(
      <AppsTab
        targetTabId={1}
        oktaOrigin={ORIGIN}
        selectedAppId="0oaFAKENOSUCH"
        onAppSelected={onAppSelected}
      />,
    );

    expect(await screen.findByText('Salesforce')).toBeInTheDocument();
    expect(screen.getByText('Workday HR')).toBeInTheDocument();
    await waitFor(() => expect(onAppSelected).toHaveBeenCalledTimes(1));
  });

  it('defers the auto-load while the tab is mounted but not the visible one', async () => {
    // App keeps every visited tab mounted and hides the inactive ones. Paging the
    // whole app inventory from a tab nobody is looking at is exactly the
    // background traffic that must not happen.
    const { rerender } = render(<AppsTab targetTabId={1} oktaOrigin={ORIGIN} isActive={false} />);

    await waitFor(() => expect(syncCalls()).toHaveLength(0));

    rerender(<AppsTab targetTabId={1} oktaOrigin={ORIGIN} isActive />);
    expect(await screen.findByText('Salesforce')).toBeInTheDocument();
    expect(syncCalls()).toHaveLength(1);
  });
});
