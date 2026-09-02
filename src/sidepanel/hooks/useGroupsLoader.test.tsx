/**
 * Tests for `useGroupsLoader` after ADR-0040.
 *
 * The hook stopped *running* the load and started *reading* it, so this suite
 * pins the four behaviours that move as a consequence:
 *
 * - a seeded org paints with no request at all (the warm path);
 * - a cold org repaints per page, driven by the background's `snapshotUpdated`
 *   broadcast rather than by one resolve at the end of the walk;
 * - push mappings arrive *after* the list, and patch rows in;
 * - a read that resolves for an org the panel has already left is dropped;
 * - a plain load takes the cheapest honest mode and only Refresh forces a walk.
 *
 * That last one is the replacement for the "stale wins" race
 * `GroupsTab.test.tsx` used to pin: it asserts the fix rather than the defect.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGroupsLoader } from './useGroupsLoader';

// ---------------------------------------------------------------------------
// IndexedDB fake
// ---------------------------------------------------------------------------
// jsdom has no IndexedDB and `fake-indexeddb` is not a dependency, so `idb` is
// faked with a Map, as `shared/snapshot/orgSnapshotStore.test.ts` does. The
// extra `gate` is what makes the superseded-org case constructible: it holds a
// collection read open until the test lets it resolve.
const { fakeDB, idbTables, gate } = await vi.hoisted(async () => {
  const { createFakeIdb } = await import('@/test/factories/idb');
  const { fakeDB: baseDB, tables: idbTables } = createFakeIdb();
  // Held by ORIGIN, not by a flag the test can clear before the read even
  // reaches the store — the whole case depends on one org's read still being in
  // flight when the panel has moved to another.
  const gate = { origin: null as string | null, waited: Promise.resolve(), release: () => {} };
  const fakeDB = {
    ...baseDB,
    getAllFromIndex: async (name: string, index: string, origin: string) => {
      if (name === 'groups' && origin === gate.origin) await gate.waited;
      return baseDB.getAllFromIndex(name, index, origin);
    },
  };
  return { fakeDB, idbTables, gate };
});

vi.mock('idb', () => ({ openDB: vi.fn(async () => fakeDB) }));

// ---------------------------------------------------------------------------
// chrome mocks
// ---------------------------------------------------------------------------
const runtimeSendMessage = vi.fn();
const listeners = new Set<(msg: any) => void>();

globalThis.chrome = {
  runtime: {
    sendMessage: runtimeSendMessage,
    getURL: (p: string) => p,
    onMessage: {
      addListener: (fn: any) => listeners.add(fn),
      removeListener: (fn: any) => listeners.delete(fn),
    },
  },
} as any;

const ORIGIN = 'https://x.okta.com';
const OTHER_ORIGIN = 'https://y.okta.com';

/** Broadcast the background's per-page progress message to the panel. */
function broadcastPage(origin = ORIGIN, collection = 'groups') {
  for (const listener of [...listeners]) {
    listener({ action: 'snapshotUpdated', origin, collection, loaded: 1, complete: false });
  }
}

function rawGroup(over: Record<string, any> = {}) {
  return {
    id: 'g1',
    type: 'OKTA_GROUP',
    profile: { name: 'Engineering' },
    _embedded: { stats: { usersCount: 4 } },
    ...over,
  };
}

function seed(collection: string, rows: Record<string, any>[], origin = ORIGIN, complete = true) {
  const table = idbTables.get(collection) ?? new Map();
  for (const entity of rows) {
    table.set(`${origin}::${entity.id}`, { origin, id: entity.id, entity, syncedAt: 1 });
  }
  idbTables.set(collection, table);
  const meta = idbTables.get('syncMeta') ?? new Map();
  meta.set(`${origin}::${collection}`, {
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
  });
  idbTables.set('syncMeta', meta);
}

/** The hook's inputs, with the shell's callbacks captured as spies. */
function harness(over: Record<string, any> = {}) {
  const options = {
    targetTabId: 1 as number | null,
    oktaOrigin: ORIGIN as string | null,
    setError: vi.fn(),
    setSearchMode: vi.fn(),
    onLoaded: vi.fn(),
    ...over,
  };
  return { options };
}

/**
 * Seed app-group assignments, as a completed fan-out walk leaves them.
 *
 * Keyed `${appId}::${groupId}` rather than by the row's own id, because Okta
 * returns the assigned *group's* id on an assignment — the app it belongs to
 * exists only in the key (ADR-0040, `APP_GROUPS_SPEC`).
 */
function seedAssignments(
  entries: Array<{ appId: string; groupId: string; name?: string }>,
  origin = ORIGIN,
) {
  const table = idbTables.get('appGroups') ?? new Map();
  for (const { appId, groupId, name } of entries) {
    const id = `${appId}::${groupId}`;
    table.set(`${origin}::${id}`, {
      origin,
      id,
      entity: {
        id: groupId,
        priority: 0,
        profile: { name: name ?? 'Pushed Group' },
        _links: { group: { href: `${origin}/api/v1/groups/${groupId}` } },
      },
      syncedAt: 1,
    });
  }
  idbTables.set('appGroups', table);
}

beforeEach(() => {
  vi.clearAllMocks();
  idbTables.clear();
  listeners.clear();
  gate.origin = null;
  gate.waited = Promise.resolve();
  runtimeSendMessage.mockResolvedValue({ success: true });
});

describe('useGroupsLoader', () => {
  it('paints a seeded org without issuing a request', async () => {
    seed('groups', [rawGroup()]);
    const { options } = harness();

    const { result } = renderHook(() => useGroupsLoader(options as any));

    await waitFor(() => expect(result.current.groups.map((g) => g.name)).toEqual(['Engineering']));
    // The whole point of the snapshot: a warm org costs nothing.
    expect(runtimeSendMessage).not.toHaveBeenCalled();
    expect(result.current.complete).toBe(true);
    // A seeded list is a cached list, so the tab leaves live-search mode.
    expect(options.setSearchMode).toHaveBeenCalledWith('cached');
  });

  it('repaints per page as the background broadcasts progress', async () => {
    seed('groups', [rawGroup()], ORIGIN, false);
    const { options } = harness();

    const { result } = renderHook(() => useGroupsLoader(options as any));
    await waitFor(() => expect(result.current.groups).toHaveLength(1));
    // A partial walk says so, rather than passing a prefix off as the org.
    expect(result.current.complete).toBe(false);

    seed(
      'groups',
      [rawGroup(), rawGroup({ id: 'g2', profile: { name: 'Design' } })],
      ORIGIN,
      false,
    );
    await act(async () => broadcastPage());

    await waitFor(() => expect(result.current.groups).toHaveLength(2));
  });

  it('ignores a broadcast for another org or another collection', async () => {
    seed('groups', [rawGroup()]);
    const { options } = harness();
    const { result } = renderHook(() => useGroupsLoader(options as any));
    await waitFor(() => expect(result.current.groups).toHaveLength(1));

    seed('groups', [rawGroup({ id: 'g2', profile: { name: 'Design' } })]);
    await act(async () => broadcastPage(OTHER_ORIGIN));
    await act(async () => broadcastPage(ORIGIN, 'apps'));

    expect(result.current.groups).toHaveLength(1);
  });

  it('attributes rules from the snapshot rules collection', async () => {
    seed('groups', [rawGroup()]);
    seed('rules', [
      {
        id: '0prFAKE',
        name: 'Engineers',
        status: 'ACTIVE',
        type: 'group_rule',
        created: '2024-01-01T00:00:00.000Z',
        lastUpdated: '2024-01-01T00:00:00.000Z',
        conditions: {
          expression: { value: 'user.department=="Eng"', type: 'urn:okta:expression:1.0' },
        },
        actions: { assignUserToGroups: { groupIds: ['g1'] } },
      },
    ]);
    const { options } = harness();

    const { result } = renderHook(() => useGroupsLoader(options as any));

    await waitFor(() => expect(result.current.groups[0]?.ruleCount).toBe(1));
    expect(result.current.groups[0]?.hasRules).toBe(true);
  });

  // RETARGETED. This used to pin "the row lands first, unenriched, and mappings
  // patch in afterwards" — the deferred pass, which cost ~40 requests on every
  // panel open. The background walks app-group assignments now, so there is no
  // second phase to arrive late; the property worth pinning is the stronger one
  // that replaced it.
  it('shows push mappings from the snapshot without asking Okta for anything', async () => {
    seed('groups', [rawGroup({ id: 'g1', type: 'APP_GROUP', source: { id: 'app1' } })]);
    seed('apps', [{ id: 'app1', label: 'Slack' }]);
    seedAssignments([{ appId: 'app1', groupId: 'g1' }]);
    const { options } = harness();

    const { result } = renderHook(() => useGroupsLoader(options as any));

    await waitFor(() => expect(result.current.groups).toHaveLength(1));
    await waitFor(() =>
      expect(result.current.groups[0]?.pushMappings).toEqual([
        expect.objectContaining({ appId: 'app1', appName: 'Slack', sourceUserGroupId: 'g1' }),
      ]),
    );
    // The whole point: a warm org pays nothing for the answer.
    expect(runtimeSendMessage).not.toHaveBeenCalled();
  });

  it('names a source app from the inventory when the group walk did not embed one', async () => {
    // `expand=app` usually carries the name; when it does not, the app inventory
    // is already on disk and answers for free rather than costing a lookup.
    seed('groups', [rawGroup({ id: 'g1', type: 'APP_GROUP', source: { id: 'app1' } })]);
    seed('apps', [{ id: 'app1', label: 'Slack' }]);
    const { options } = harness();

    const { result } = renderHook(() => useGroupsLoader(options as any));

    await waitFor(() => expect(result.current.groups[0]?.sourceAppName).toBe('Slack'));
    expect(runtimeSendMessage).not.toHaveBeenCalled();
  });

  it("keeps one app's mappings when another app assigns the same group", async () => {
    // The storage-key collision `APP_GROUPS_SPEC.identify` exists to prevent,
    // asserted where a user would notice it: both apps must reach the row.
    seed('groups', [rawGroup({ id: 'g1', type: 'APP_GROUP', source: { id: 'app1' } })]);
    seed('apps', [
      { id: 'app1', label: 'Slack' },
      { id: 'app2', label: 'Zoom' },
    ]);
    seedAssignments([
      { appId: 'app1', groupId: 'g1' },
      { appId: 'app2', groupId: 'g1' },
    ]);
    const { options } = harness();

    const { result } = renderHook(() => useGroupsLoader(options as any));

    await waitFor(() => expect(result.current.groups[0]?.pushMappings).toHaveLength(2));
    expect(result.current.groups[0]?.pushMappings?.map((m) => m.appName).sort()).toEqual([
      'Slack',
      'Zoom',
    ]);
  });

  it('asks for the cheapest honest mode, and forces a full walk only on Refresh', async () => {
    const { options } = harness();
    const { result } = renderHook(() => useGroupsLoader(options as any));

    // "Load All Groups" and the empty-state CTA mean *get me the groups*. Forcing
    // there made the delta and drift modes unreachable from the only flow that
    // loads this tab, so a warm org re-walked every page it already had — the
    // whole cost ADR-0040 exists to remove.
    await act(async () => {
      await result.current.loadAllGroups();
    });
    await act(async () => {
      await result.current.loadAllGroups(true);
    });

    const forces = runtimeSendMessage.mock.calls
      .map((call) => call[0])
      .filter((msg) => msg?.action === 'syncSnapshot')
      .map((msg) => msg.force);
    expect(forces).toEqual([false, true]);
  });

  it('does not sync while the tab is hidden', async () => {
    seed('groups', []);
    const { options } = harness({ enabled: false });
    const { result } = renderHook(() => useGroupsLoader(options as any));

    await act(async () => {
      await result.current.loadAllGroups();
    });

    // ADR-0018: the tab stays mounted when hidden, so the fetch is gated instead.
    expect(runtimeSendMessage).not.toHaveBeenCalled();
  });

  it('banners the failure message when a walk does not complete', async () => {
    runtimeSendMessage.mockResolvedValue({ success: false, error: 'Failed to fetch groups' });
    const { options } = harness();
    const { result } = renderHook(() => useGroupsLoader(options as any));

    await act(async () => {
      await result.current.loadAllGroups();
    });

    expect(options.setError).toHaveBeenCalledWith('Failed to fetch groups');
    // The tab stays in live mode; a failed load is not a cached list.
    expect(options.setSearchMode).not.toHaveBeenCalledWith('cached');
    expect(options.onLoaded).not.toHaveBeenCalled();
  });

  it('drops a read that resolves for an org the panel has already left', async () => {
    seed('groups', [rawGroup({ id: 'gA', profile: { name: 'OrgA Group' } })], ORIGIN);
    seed('groups', [rawGroup({ id: 'gB', profile: { name: 'OrgB Group' } })], OTHER_ORIGIN);

    // Hold org A's read open — and only org A's — so it is still in flight when
    // the panel moves on.
    gate.origin = ORIGIN;
    gate.waited = new Promise<void>((resolve) => {
      gate.release = resolve;
    });

    const { options } = harness();
    const { result, rerender } = renderHook((props: any) => useGroupsLoader(props), {
      initialProps: options,
    });
    // Org A's read has not resolved, so nothing is on screen yet.
    expect(result.current.groups).toEqual([]);

    rerender({ ...options, oktaOrigin: OTHER_ORIGIN });
    await waitFor(() => expect(result.current.groups.map((g) => g.name)).toEqual(['OrgB Group']));

    // Now let org A's read finally land, behind org B's.
    await act(async () => {
      gate.release();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // The superseded org's rows never appear under the new org's identity.
    expect(result.current.groups.map((g) => g.name)).toEqual(['OrgB Group']);
  });
});
