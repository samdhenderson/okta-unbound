/**
 * @module shared/snapshot/snapshotSync.test
 * @description Tests for ADR-0040's full walk.
 *
 * The transport is injected, so these drive the walk with canned pages and
 * `Link` headers — no `chrome.*`, no network. `idb` is faked the same way
 * `orgSnapshotStore.test.ts` fakes it, because the walk's whole job is what it
 * leaves in the store.
 *
 * The cases that matter are the reconciliation ones. A full walk is the only
 * thing entitled to conclude a deletion, so a walk that *failed* must sweep
 * nothing and must not present as complete; and a walk that *resumed* must still
 * sweep the rows its interrupted pages had returned, which is the property the
 * timestamp mark buys over a set of seen ids.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PaginatedPageResult } from '../utils/oktaPagination';
import type { SnapshotRecord } from './types';

const { fakeDB, tables, control } = vi.hoisted(() => {
  const tables = new Map<string, Map<string, unknown>>();
  const control = { failAll: false };

  const keyOf = (key: unknown): string => (Array.isArray(key) ? key.join('::') : String(key));
  const table = (name: string): Map<string, unknown> => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name) as Map<string, unknown>;
  };
  const guard = (): void => {
    if (control.failAll) throw new Error('IndexedDB unavailable');
  };
  const primaryKey = (name: string, value: unknown): unknown[] => {
    const row = value as Record<string, string>;
    return name === 'syncMeta' ? [row.origin, row.collection] : [row.origin, row.id];
  };

  const fakeDB = {
    get: vi.fn(async (name: string, key: unknown) => {
      guard();
      return table(name).get(keyOf(key));
    }),
    put: vi.fn(async (name: string, value: unknown) => {
      guard();
      table(name).set(keyOf(primaryKey(name, value)), value);
    }),
    delete: vi.fn(async (name: string, key: unknown) => {
      guard();
      table(name).delete(keyOf(key));
    }),
    getAllFromIndex: vi.fn(async (name: string, _index: string, origin: string) => {
      guard();
      return [...table(name).values()].filter((v) => (v as SnapshotRecord).origin === origin);
    }),
    getAllKeysFromIndex: vi.fn(async (name: string, _index: string, origin: string) => {
      guard();
      return [...table(name).values()]
        .filter((v) => (v as SnapshotRecord).origin === origin)
        .map((v) => primaryKey(name, v));
    }),
    transaction: vi.fn((name: string) => {
      guard();
      return {
        store: {
          put: async (value: unknown) => {
            guard();
            table(name).set(keyOf(primaryKey(name, value)), value);
          },
          delete: async (key: unknown) => {
            guard();
            table(name).delete(keyOf(key));
          },
        },
        done: Promise.resolve(),
      };
    }),
  };

  return { fakeDB, tables, control };
});

vi.mock('idb', () => ({ openDB: vi.fn(async () => fakeDB) }));

import { orgSnapshotStore } from './orgSnapshotStore';
import { z } from 'zod';
import {
  APPS_SPEC,
  GROUPS_SPEC,
  RULES_SPEC,
  runFullWalk,
  runShardedWalk,
  syncCollection,
  syncOrg,
  type CollectionSpec,
  type PageRequest,
} from './snapshotSync';

const ORIGIN = 'https://example.okta.com';
const NOW = 1_800_000_000_000;

/** One Okta group row, as `/api/v1/groups?expand=stats` returns it. */
function group(id: string, name: string, lastUpdated = '2026-08-20T09:00:00.000Z') {
  return {
    id,
    type: 'OKTA_GROUP',
    profile: { name, description: null },
    lastUpdated,
    _embedded: { stats: { usersCount: 3 } },
  };
}

/** A `Link` header pointing at `nextPath` on the org origin. */
function linkTo(nextPath: string): Record<string, string> {
  return { link: `<${ORIGIN}${nextPath}>; rel="next"` };
}

/**
 * A transport that replays scripted pages, keyed by the URL requested, and
 * records the URLs it was asked for so a test can assert what the walk sent.
 */
function scriptedRequest(pages: Record<string, PaginatedPageResult>): {
  request: PageRequest;
  urls: string[];
} {
  const urls: string[] = [];
  const request: PageRequest = async (url) => {
    urls.push(url);
    const page = pages[url];
    if (!page) throw new Error(`unscripted URL: ${url}`);
    return page;
  };
  return { request, urls };
}

/** Names of the groups currently in the snapshot, sorted. */
async function storedGroupNames(): Promise<string[]> {
  const rows = await orgSnapshotStore.getCollection<{ profile?: { name?: string } }>(
    'groups',
    ORIGIN,
  );
  return rows.map((row) => row.profile?.name ?? '?').sort();
}

beforeEach(() => {
  tables.clear();
  control.failAll = false;
  vi.clearAllMocks();
});

describe('a completed full walk', () => {
  it('accumulates every page into the snapshot and marks the collection complete', async () => {
    const page2 = '/api/v1/groups?limit=200&after=cur1';
    const { request } = scriptedRequest({
      [GROUPS_SPEC.firstUrl]: {
        success: true,
        data: [group('00g1', 'Eng'), group('00g2', 'Sales')],
        headers: linkTo(page2),
      },
      [`${page2}&expand=stats&expand=app`]: {
        success: true,
        data: [group('00g3', 'Support')],
        headers: {},
      },
    });

    const outcome = await runFullWalk(GROUPS_SPEC, { origin: ORIGIN, request, now: NOW });

    expect(outcome).toMatchObject({ collection: 'groups', complete: true, written: 3, swept: 0 });
    await expect(storedGroupNames()).resolves.toEqual(['Eng', 'Sales', 'Support']);

    const meta = await orgSnapshotStore.getMeta('groups', ORIGIN);
    expect(meta).toMatchObject({
      complete: true,
      lastFullWalkAt: NOW,
      cursor: null,
      walkStartedAt: null,
      itemCount: 3,
    });
  });

  it('announces each page as it lands rather than once at the end', async () => {
    const page2 = '/api/v1/groups?limit=200&after=cur1';
    const { request } = scriptedRequest({
      [GROUPS_SPEC.firstUrl]: {
        success: true,
        data: [group('00g1', 'Eng')],
        headers: linkTo(page2),
      },
      [`${page2}&expand=stats&expand=app`]: {
        success: true,
        data: [group('00g2', 'Sales')],
        headers: {},
      },
    });
    const onPage = vi.fn();

    await runFullWalk(GROUPS_SPEC, { origin: ORIGIN, request, now: NOW, onPage });

    // This is the whole point of streaming: the first row is announced after the
    // first page, not after the last.
    expect(onPage.mock.calls).toEqual([
      ['groups', 1],
      ['groups', 2],
    ]);
  });

  it('advances the watermark to the newest lastUpdated it saw, whatever the page order', async () => {
    const page2 = '/api/v1/groups?limit=200&after=cur1';
    const { request } = scriptedRequest({
      [GROUPS_SPEC.firstUrl]: {
        success: true,
        data: [group('00g1', 'Eng', '2026-08-24T11:00:00.000Z')],
        headers: linkTo(page2),
      },
      [`${page2}&expand=stats&expand=app`]: {
        success: true,
        data: [group('00g2', 'Sales', '2026-08-20T09:00:00.000Z')],
        headers: {},
      },
    });

    await runFullWalk(GROUPS_SPEC, { origin: ORIGIN, request, now: NOW });

    expect((await orgSnapshotStore.getMeta('groups', ORIGIN)).watermark).toBe(
      '2026-08-24T11:00:00.000Z',
    );
  });

  it('re-appends the expand values Okta dropped from its next link', async () => {
    // Okta echoes `expand=stats` and is not guaranteed to echo `expand=app`.
    // Comparing by parameter *name* would see `expand` present and conclude
    // nothing was dropped, losing the source-app embed on every page after the
    // first — which is the whole reason the label phase could be deleted.
    const echoed = '/api/v1/groups?limit=200&after=cur1&expand=stats';
    const { request, urls } = scriptedRequest({
      [GROUPS_SPEC.firstUrl]: {
        success: true,
        data: [group('00g1', 'Eng')],
        headers: linkTo(echoed),
      },
      [`${echoed}&expand=app`]: { success: true, data: [group('00g2', 'Sales')], headers: {} },
    });

    await runFullWalk(GROUPS_SPEC, { origin: ORIGIN, request, now: NOW });

    expect(urls[1]).toBe(`${echoed}&expand=app`);
    // And it did not duplicate the one Okta did echo.
    expect(urls[1].match(/expand=stats/g)).toHaveLength(1);
  });

  it('drops a row with no usable id instead of failing the walk', async () => {
    const { request } = scriptedRequest({
      [GROUPS_SPEC.firstUrl]: {
        success: true,
        data: [group('00g1', 'Eng'), { profile: { name: 'No id' } }],
        headers: {},
      },
    });

    const outcome = await runFullWalk(GROUPS_SPEC, { origin: ORIGIN, request, now: NOW });

    expect(outcome.complete).toBe(true);
    await expect(storedGroupNames()).resolves.toEqual(['Eng']);
  });
});

describe('reconciliation', () => {
  it('sweeps a group that Okta no longer returns', async () => {
    const first = scriptedRequest({
      [GROUPS_SPEC.firstUrl]: {
        success: true,
        data: [group('00g1', 'Eng'), group('00g2', 'Sales')],
        headers: {},
      },
    });
    await runFullWalk(GROUPS_SPEC, { origin: ORIGIN, request: first.request, now: NOW });
    await expect(storedGroupNames()).resolves.toEqual(['Eng', 'Sales']);

    // Sales was deleted in Okta. No `lastUpdated` can express that, so only a
    // completed walk can conclude it.
    const second = scriptedRequest({
      [GROUPS_SPEC.firstUrl]: { success: true, data: [group('00g1', 'Eng')], headers: {} },
    });
    const outcome = await runFullWalk(GROUPS_SPEC, {
      origin: ORIGIN,
      request: second.request,
      now: NOW + 60_000,
    });

    expect(outcome.swept).toBe(1);
    await expect(storedGroupNames()).resolves.toEqual(['Eng']);
    expect((await orgSnapshotStore.getMeta('groups', ORIGIN)).itemCount).toBe(1);
  });

  it('keeps a row the walk re-returned unchanged', async () => {
    const pages = {
      [GROUPS_SPEC.firstUrl]: { success: true, data: [group('00g1', 'Eng')], headers: {} },
    };
    await runFullWalk(GROUPS_SPEC, {
      origin: ORIGIN,
      request: scriptedRequest(pages).request,
      now: NOW,
    });
    const outcome = await runFullWalk(GROUPS_SPEC, {
      origin: ORIGIN,
      request: scriptedRequest(pages).request,
      now: NOW + 60_000,
    });

    expect(outcome.swept).toBe(0);
    await expect(storedGroupNames()).resolves.toEqual(['Eng']);
  });
});

describe('a walk that did not finish', () => {
  it('keeps the rows it got, sweeps nothing, and does not present as complete', async () => {
    const page2 = '/api/v1/groups?limit=200&after=cur1';
    const { request } = scriptedRequest({
      [GROUPS_SPEC.firstUrl]: {
        success: true,
        data: [group('00g1', 'Eng')],
        headers: linkTo(page2),
      },
      [`${page2}&expand=stats&expand=app`]: { success: false, error: 'rate limited' },
    });

    const outcome = await runFullWalk(GROUPS_SPEC, { origin: ORIGIN, request, now: NOW });

    expect(outcome).toMatchObject({ complete: false, swept: 0 });
    expect(outcome.error).toBe('rate limited');
    // Page 1's rows are real and are kept — but sweeping here would delete every
    // group the unreached pages would have returned.
    await expect(storedGroupNames()).resolves.toEqual(['Eng']);

    const meta = await orgSnapshotStore.getMeta('groups', ORIGIN);
    expect(meta.complete).toBe(false);
    // The resume point survives, and so does the mark that makes resuming sweep
    // correctly.
    expect(meta.cursor).toBe(`${page2}&expand=stats&expand=app`);
    expect(meta.walkStartedAt).toBe(NOW);
  });

  it("carries the failing page's HTTP status, so a 403 is distinguishable from a 429 (D-068)", async () => {
    // Two walks that both stop early must not be indistinguishable: a
    // permissions failure and a rate limit call for different admin-facing
    // copy (`orgFigures.ts`), and neither can be told apart from `error`
    // alone once it has been reduced to a human-readable string.
    const page2 = '/api/v1/groups?limit=200&after=cur1';
    const { request: forbidden } = scriptedRequest({
      [GROUPS_SPEC.firstUrl]: {
        success: true,
        data: [group('00g1', 'Eng')],
        headers: linkTo(page2),
      },
      [`${page2}&expand=stats&expand=app`]: { success: false, error: 'Forbidden', status: 403 },
    });
    const forbiddenOutcome = await runFullWalk(GROUPS_SPEC, {
      origin: ORIGIN,
      request: forbidden,
      now: NOW,
    });
    expect(forbiddenOutcome.status).toBe(403);

    const { request: rateLimited } = scriptedRequest({
      [GROUPS_SPEC.firstUrl]: {
        success: true,
        data: [group('00g1', 'Eng')],
        headers: linkTo(page2),
      },
      [`${page2}&expand=stats&expand=app`]: {
        success: false,
        error: 'rate limited',
        status: 429,
      },
    });
    const rateLimitedOutcome = await runFullWalk(GROUPS_SPEC, {
      origin: ORIGIN,
      request: rateLimited,
      now: NOW,
    });
    expect(rateLimitedOutcome.status).toBe(429);
    expect(rateLimitedOutcome.status).not.toBe(forbiddenOutcome.status);
  });

  it('resumes from the cursor and still sweeps what the interrupted pages had returned', async () => {
    // Seed a stale row from an older walk. It must be swept when the resumed
    // walk completes, even though the resumed portion never returned it — which
    // is exactly what a seen-id set, lost with the interrupted run, could not do.
    await orgSnapshotStore.upsertMany(
      'groups',
      ORIGIN,
      [{ id: '00gOLD', entity: group('00gOLD', 'Deleted') }],
      NOW - 100_000,
    );

    const page2 = '/api/v1/groups?limit=200&after=cur1';
    const failing = scriptedRequest({
      [GROUPS_SPEC.firstUrl]: {
        success: true,
        data: [group('00g1', 'Eng')],
        headers: linkTo(page2),
      },
      [`${page2}&expand=stats&expand=app`]: { success: false, error: 'worker suspended' },
    });
    await runFullWalk(GROUPS_SPEC, { origin: ORIGIN, request: failing.request, now: NOW });

    // The retry starts at the cursor, not at the collection's first URL.
    const resumed = scriptedRequest({
      [`${page2}&expand=stats&expand=app`]: {
        success: true,
        data: [group('00g2', 'Sales')],
        headers: {},
      },
    });
    const outcome = await runFullWalk(GROUPS_SPEC, {
      origin: ORIGIN,
      request: resumed.request,
      now: NOW + 60_000,
    });

    expect(resumed.urls).toEqual([`${page2}&expand=stats&expand=app`]);
    expect(outcome.complete).toBe(true);
    // Page 1's row survives the sweep (it carries the same mark); the stale row
    // from the older walk does not.
    expect(outcome.swept).toBe(1);
    await expect(storedGroupNames()).resolves.toEqual(['Eng', 'Sales']);
  });
});

describe('syncOrg', () => {
  it('walks the collections concurrently rather than one after the other', async () => {
    const inFlight: string[] = [];
    let releaseGroups: () => void = () => {};
    const groupsHeld = new Promise<void>((resolve) => {
      releaseGroups = resolve;
    });

    const request: PageRequest = async (url) => {
      inFlight.push(url);
      if (url === GROUPS_SPEC.firstUrl) {
        // Hold the groups walk open. If the two walks were sequential, the rules
        // request could never be issued while this one is still pending.
        await groupsHeld;
        return { success: true, data: [group('00g1', 'Eng')], headers: {} };
      }
      return {
        success: true,
        data: [{ id: '0pr1', name: 'By dept', status: 'ACTIVE' }],
        headers: {},
      };
    };

    const running = syncOrg({ origin: ORIGIN, request, now: NOW });
    await vi.waitFor(() => expect(inFlight).toContain(RULES_SPEC.firstUrl));
    releaseGroups();

    const outcomes = await running;
    expect(outcomes.map((o) => [o.collection, o.complete])).toEqual([
      ['groups', true],
      ['rules', true],
      ['apps', true],
      ['appGroups', true],
    ]);
    await expect(orgSnapshotStore.countCollection('rules', ORIGIN)).resolves.toBe(1);
  });

  it('waits for the app inventory before deriving which apps to walk', async () => {
    // `appGroups` decides *what to walk* by reading the apps collection, so
    // running it alongside the walk that fills that collection would have it ask
    // a cold store, find nothing, and record an empty fan-out as a success — with
    // nothing to re-derive it until the refresh interval elapsed.
    const order: string[] = [];
    const request: PageRequest = async (url) => {
      order.push(url);
      if (url === APPS_SPEC.firstUrl) {
        return {
          success: true,
          data: [{ id: '0oaA', label: 'Payroll', features: ['GROUP_PUSH'] }],
          headers: {},
        };
      }
      if (url.startsWith('/api/v1/apps/0oaA/groups')) {
        return { success: true, data: [{ id: '00g1' }], headers: {} };
      }
      return { success: true, data: [], headers: {} };
    };

    const outcomes = await syncOrg({ origin: ORIGIN, request, now: NOW });

    // The fan-out was derived from the inventory this same pass had just written.
    expect(order.indexOf('/api/v1/apps/0oaA/groups?limit=200')).toBeGreaterThan(
      order.indexOf(APPS_SPEC.firstUrl),
    );
    expect(outcomes.find((o) => o.collection === 'appGroups')).toMatchObject({
      complete: true,
      written: 1,
    });
    await expect(orgSnapshotStore.getIds('appGroups', ORIGIN)).resolves.toEqual(
      new Set(['0oaA::00g1']),
    );
  });

  it('retries rather than recording an empty fan-out when the inventory is cold', async () => {
    // A failed apps walk leaves nothing to derive shards from. Concluding "no app
    // pushes groups" from that would satisfy the collection for its whole refresh
    // interval on the strength of a request that failed.
    const request: PageRequest = async (url) => {
      if (url === APPS_SPEC.firstUrl) return { success: false, error: 'apps unavailable' };
      return { success: true, data: [], headers: {} };
    };

    const outcomes = await syncOrg({ origin: ORIGIN, request, now: NOW });

    expect(outcomes.find((o) => o.collection === 'appGroups')).toMatchObject({ complete: false });
    const meta = await orgSnapshotStore.getMeta('appGroups', ORIGIN);
    expect(meta.complete).toBe(false);
    expect(meta.lastFullWalkAt).toBeNull();
  });

  it('lands the collections that succeeded when one of them fails', async () => {
    const request: PageRequest = async (url) => {
      if (url === GROUPS_SPEC.firstUrl) return { success: false, error: 'groups unavailable' };
      return {
        success: true,
        data: [{ id: '0pr1', name: 'By dept', status: 'ACTIVE' }],
        headers: {},
      };
    };

    const outcomes = await syncOrg({ origin: ORIGIN, request, now: NOW });

    expect(outcomes[0]).toMatchObject({ collection: 'groups', complete: false });
    expect(outcomes[1]).toMatchObject({ collection: 'rules', complete: true });
    await expect(orgSnapshotStore.countCollection('rules', ORIGIN)).resolves.toBe(1);
  });
});

// ===========================================================================
// The cheap modes (ADR-0040 §3)
// ===========================================================================
// The pairing is the whole correctness argument: a delta sees creates and edits
// and *cannot* see a deletion, because nothing is updated when a row disappears.
// The drift check is the one-request backstop that catches exactly that, and
// escalates. These pin both halves, plus the probe that refuses to trust a
// `search` filter Okta may have silently ignored.

/** `limit=1`, no expands — the drift check only wants the count header. */
const COUNT_URL = '/api/v1/groups?limit=1';

/** The support probe: a watermark no row can be newer than. */
const PROBE_URL = `/api/v1/groups?${new URLSearchParams({
  limit: '1',
  search: 'lastUpdated gt "9999-01-01T00:00:00.000Z"',
}).toString()}`;

/** The delta listing: the canonical first page, filtered by watermark. */
function deltaUrlFor(watermark: string): string {
  return `${GROUPS_SPEC.firstUrl}&search=${encodeURIComponent(`lastUpdated gt "${watermark}"`)}`;
}

const WATERMARK = '2026-08-20T09:00:00.000Z';

/**
 * Put the groups collection in the state a completed walk would have left it,
 * so the freshness ladder has something to reason about.
 */
async function seedSyncedCollection(
  rows: ReturnType<typeof group>[],
  meta: Record<string, unknown> = {},
): Promise<void> {
  await orgSnapshotStore.upsertMany(
    'groups',
    ORIGIN,
    rows.map((row) => ({ id: row.id, entity: row })),
    NOW,
  );
  await orgSnapshotStore.patchMeta('groups', ORIGIN, {
    complete: true,
    lastFullWalkAt: NOW,
    lastDeltaAt: NOW,
    watermark: WATERMARK,
    itemCount: rows.length,
    cursor: null,
    walkStartedAt: null,
    deltaSupported: true,
    ...meta,
  });
}

describe('delta sync', () => {
  it('refuses to trust a search filter the org silently ignored, and full-walks instead', async () => {
    await seedSyncedCollection([group('00g1', 'Eng')], { deltaSupported: null });
    const { request, urls } = scriptedRequest({
      // The org answered 200 and returned everything — i.e. it ignored `search`.
      [PROBE_URL]: { success: true, data: [], headers: { 'x-total-count': '1' } },
      [GROUPS_SPEC.firstUrl]: { success: true, data: [group('00g1', 'Eng')], headers: {} },
    });

    const outcome = await syncCollection(GROUPS_SPEC, { origin: ORIGIN, request, now: NOW + 1000 });

    expect(outcome.mode).toBe('full');
    expect(urls).toContain(GROUPS_SPEC.firstUrl);
    // Recorded, so the org is never asked to prove it twice.
    const meta = await orgSnapshotStore.getMeta('groups', ORIGIN);
    expect(meta.deltaSupported).toBe(false);
  });

  it('treats an unanswerable probe as unsupported rather than as support', async () => {
    await seedSyncedCollection([group('00g1', 'Eng')], { deltaSupported: null });
    const { request } = scriptedRequest({
      // No `x-total-count` at all: the org did not say whether it filtered.
      [PROBE_URL]: { success: true, data: [], headers: {} },
      [GROUPS_SPEC.firstUrl]: { success: true, data: [group('00g1', 'Eng')], headers: {} },
    });

    const outcome = await syncCollection(GROUPS_SPEC, { origin: ORIGIN, request, now: NOW + 1000 });

    expect(outcome.mode).toBe('full');
    await expect(
      orgSnapshotStore.getMeta('groups', ORIGIN).then((m) => m.deltaSupported),
    ).resolves.toBe(false);
  });

  it('fetches only what changed, and leaves untouched rows alone', async () => {
    await seedSyncedCollection([group('00g1', 'Eng'), group('00g2', 'Sales')]);
    const { request, urls } = scriptedRequest({
      [deltaUrlFor(WATERMARK)]: {
        success: true,
        data: [
          group('00g2', 'Sales EMEA', '2026-08-24T10:00:00.000Z'),
          group('00g3', 'Support', '2026-08-24T11:00:00.000Z'),
        ],
        headers: {},
      },
    });

    const outcome = await syncCollection(GROUPS_SPEC, { origin: ORIGIN, request, now: NOW + 1000 });

    expect(outcome).toMatchObject({ mode: 'delta', complete: true, written: 2, swept: 0 });
    // 'Eng' was never returned by the delta — and a filtered listing is no
    // evidence at all about the rows it excluded, so it must survive.
    await expect(storedGroupNames()).resolves.toEqual(['Eng', 'Sales EMEA', 'Support']);
    // One request, not a walk.
    expect(urls).toEqual([deltaUrlFor(WATERMARK)]);

    const meta = await orgSnapshotStore.getMeta('groups', ORIGIN);
    expect(meta.watermark).toBe('2026-08-24T11:00:00.000Z');
    expect(meta.lastDeltaAt).toBe(NOW + 1000);
    expect(meta.itemCount).toBe(3);
  });

  it('leaves the snapshot whole and retryable when the delta request fails', async () => {
    await seedSyncedCollection([group('00g1', 'Eng')]);
    const { request } = scriptedRequest({
      [deltaUrlFor(WATERMARK)]: { success: false, error: 'delta unavailable' },
    });

    const outcome = await syncCollection(GROUPS_SPEC, { origin: ORIGIN, request, now: NOW + 1000 });

    expect(outcome).toMatchObject({ mode: 'delta', complete: true, error: 'delta unavailable' });
    // Still whole as of the last full walk — just no fresher than it was.
    const meta = await orgSnapshotStore.getMeta('groups', ORIGIN);
    expect(meta.complete).toBe(true);
    expect(meta.lastDeltaAt).toBe(NOW);
    await expect(storedGroupNames()).resolves.toEqual(['Eng']);
  });
});

describe('drift check', () => {
  /** Far enough past the last check that a drift check is owed. */
  const LATER = NOW + 16 * 60 * 1000;

  it('catches a deletion a delta could never see, and escalates to a full walk', async () => {
    await seedSyncedCollection([group('00g1', 'Eng'), group('00g2', 'Sales')]);
    const { request, urls } = scriptedRequest({
      // Okta says one; the snapshot holds two. Something was deleted.
      [COUNT_URL]: { success: true, data: [], headers: { 'x-total-count': '1' } },
      [GROUPS_SPEC.firstUrl]: { success: true, data: [group('00g1', 'Eng')], headers: {} },
    });

    const outcome = await syncCollection(GROUPS_SPEC, { origin: ORIGIN, request, now: LATER });

    expect(outcome.mode).toBe('full');
    expect(outcome.swept).toBe(1);
    await expect(storedGroupNames()).resolves.toEqual(['Eng']);
    expect(urls[0]).toBe(COUNT_URL);
  });

  it('escalates when the org does not answer the count question at all', async () => {
    await seedSyncedCollection([group('00g1', 'Eng')]);
    const { request } = scriptedRequest({
      [COUNT_URL]: { success: true, data: [], headers: {} },
      [GROUPS_SPEC.firstUrl]: { success: true, data: [group('00g1', 'Eng')], headers: {} },
    });

    const outcome = await syncCollection(GROUPS_SPEC, { origin: ORIGIN, request, now: LATER });

    // An absent header is not agreement (ADR-0040 §7): treating it as agreement
    // would let a diverged snapshot escape a full walk indefinitely.
    expect(outcome.mode).toBe('full');
  });

  it('still runs the delta when the counts agree, because an edit moves no count', async () => {
    await seedSyncedCollection([group('00g1', 'Eng')]);
    const { request, urls } = scriptedRequest({
      [COUNT_URL]: { success: true, data: [], headers: { 'x-total-count': '1' } },
      [deltaUrlFor(WATERMARK)]: {
        success: true,
        data: [group('00g1', 'Engineering', '2026-08-24T12:00:00.000Z')],
        headers: {},
      },
    });

    const outcome = await syncCollection(GROUPS_SPEC, { origin: ORIGIN, request, now: LATER });

    expect(outcome.mode).toBe('delta');
    await expect(storedGroupNames()).resolves.toEqual(['Engineering']);
    // Two requests total — and never the full listing.
    expect(urls).toEqual([COUNT_URL, deltaUrlFor(WATERMARK)]);
  });
});

describe('the freshness ladder', () => {
  it('does nothing for a snapshot that is complete, fresh and has no watermark', async () => {
    await seedSyncedCollection([], { watermark: null, itemCount: 0 });
    const { request, urls } = scriptedRequest({});

    const outcome = await syncCollection(GROUPS_SPEC, { origin: ORIGIN, request, now: NOW + 1000 });

    expect(outcome).toMatchObject({ mode: 'none', complete: true, written: 0 });
    expect(urls).toEqual([]);
  });

  it('walks in full when forced, however fresh the snapshot is', async () => {
    await seedSyncedCollection([group('00g1', 'Eng')]);
    const { request, urls } = scriptedRequest({
      [GROUPS_SPEC.firstUrl]: {
        success: true,
        data: [group('00g1', 'Eng'), group('00g2', 'Sales')],
        headers: {},
      },
    });

    const outcome = await syncCollection(GROUPS_SPEC, {
      origin: ORIGIN,
      request,
      now: NOW + 1000,
      force: true,
    });

    // Refresh means Refresh: no probe, no count check, no delta.
    expect(outcome.mode).toBe('full');
    expect(urls).toEqual([GROUPS_SPEC.firstUrl]);
    await expect(storedGroupNames()).resolves.toEqual(['Eng', 'Sales']);
  });

  it('full-walks a collection whose last walk was interrupted, rather than topping it up', async () => {
    await seedSyncedCollection([group('00g1', 'Eng')], {
      complete: false,
      // Exactly what an interrupted walk stores: the next link with the
      // expands already re-applied.
      cursor: '/api/v1/groups?limit=200&after=cur1&expand=stats&expand=app',
      walkStartedAt: NOW,
    });
    const { request } = scriptedRequest({
      '/api/v1/groups?limit=200&after=cur1&expand=stats&expand=app': {
        success: true,
        data: [group('00g2', 'Sales')],
        headers: {},
      },
    });

    const outcome = await syncCollection(GROUPS_SPEC, { origin: ORIGIN, request, now: NOW + 1000 });

    // A delta over a half-built snapshot would leave the unwalked pages missing
    // forever while every later check reported agreement.
    expect(outcome.mode).toBe('full');
    expect(outcome.complete).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Sharded walks
// ---------------------------------------------------------------------------
// A fan-out collection: N listings that together are the collection, with no
// endpoint returning them together. Modelled here on its own minimal spec rather
// than on `APP_GROUPS_SPEC`, so these pin the *engine* and stay true whatever
// shards a real collection ends up choosing.

/** One assignment row, shaped like `/api/v1/apps/{id}/groups` returns it. */
const assignmentSchema = z.object({ id: z.string() }).passthrough();

/** A shard's listing URL, matching the shape a real fan-out spec would build. */
const shardUrl = (appId: string): string => `/api/v1/apps/${appId}/groups?limit=200`;

/**
 * A fan-out spec over `apps`, keyed so two apps assigning the same group do not
 * collide. `apps` is borrowed purely as a store to write into.
 */
function shardedSpec(appIds: string[]): CollectionSpec<{ id: string }> {
  return {
    collection: 'apps',
    firstUrl: '/api/v1/apps?limit=200',
    schema: assignmentSchema,
    context: 'GET /api/v1/apps/{id}/groups',
    shards: async () => appIds.map((key) => ({ key, firstUrl: shardUrl(key) })),
    identify: (row, shard) => {
      const id = (row as { id?: unknown }).id;
      if (typeof id !== 'string' || !shard) return null;
      return { id: `${shard.key}::${id}` };
    },
    refreshIntervalMs: 6 * 60 * 60 * 1000,
  };
}

/** Every stored row key for the fan-out's collection, sorted. */
async function storedShardKeys(): Promise<string[]> {
  return [...(await orgSnapshotStore.getIds('apps', ORIGIN))].sort();
}

describe('a sharded walk', () => {
  it('keys rows by shard, so one group assigned to two apps is not one row', async () => {
    // The trap this exists for: Okta returns the assigned *group's* id as the
    // assignment id, so without the shard prefix both apps write `[origin,
    // 00g1]` and the second silently overwrites the first — an app's push
    // mappings vanishing because another app happened to share a group.
    const { request } = scriptedRequest({
      [shardUrl('0oaA')]: { success: true, data: [{ id: '00g1' }], headers: {} },
      [shardUrl('0oaB')]: { success: true, data: [{ id: '00g1' }], headers: {} },
    });

    const outcome = await runShardedWalk(shardedSpec(['0oaA', '0oaB']), {
      origin: ORIGIN,
      request,
      now: NOW,
    });

    expect(outcome).toMatchObject({ complete: true, written: 2, swept: 0 });
    await expect(storedShardKeys()).resolves.toEqual(['0oaA::00g1', '0oaB::00g1']);
  });

  it('sweeps nothing and stays incomplete when a shard fails', async () => {
    const spec = shardedSpec(['0oaA', '0oaB']);
    const first = scriptedRequest({
      [shardUrl('0oaA')]: { success: true, data: [{ id: '00g1' }], headers: {} },
      [shardUrl('0oaB')]: { success: true, data: [{ id: '00g2' }], headers: {} },
    });
    await runShardedWalk(spec, { origin: ORIGIN, request: first.request, now: NOW });

    // Second walk: one listing fails. Its rows are still real, and a fan-out
    // missing a leg is missing rows — not looking at deletions.
    const second: PageRequest = async (url) => {
      if (url === shardUrl('0oaB')) throw new Error('rate limited');
      return { success: true, data: [{ id: '00g1' }], headers: {} };
    };
    const outcome = await runShardedWalk(spec, {
      origin: ORIGIN,
      request: second,
      now: NOW + 1000,
    });

    expect(outcome).toMatchObject({ complete: false, swept: 0 });
    // 0oaB's row survives: sweeping it would have deleted a live app's
    // assignments because one request failed.
    await expect(storedShardKeys()).resolves.toEqual(['0oaA::00g1', '0oaB::00g2']);
    const meta = await orgSnapshotStore.getMeta('apps', ORIGIN);
    expect(meta.complete).toBe(false);
    // Only the shard that succeeded is recorded, so the retry is targeted.
    expect(meta.completedShards).toEqual(['0oaA']);
  });

  it('resumes without re-requesting the shards it already finished', async () => {
    const spec = shardedSpec(['0oaA', '0oaB']);
    const failing: PageRequest = async (url) => {
      if (url === shardUrl('0oaB')) throw new Error('suspended');
      return { success: true, data: [{ id: '00g1' }], headers: {} };
    };
    await runShardedWalk(spec, { origin: ORIGIN, request: failing, now: NOW });

    const retry = scriptedRequest({
      [shardUrl('0oaB')]: { success: true, data: [{ id: '00g2' }], headers: {} },
    });
    const outcome = await runShardedWalk(spec, {
      origin: ORIGIN,
      request: retry.request,
      now: NOW + 1000,
    });

    // 0oaA is not asked for again — that is the whole point of the resume unit.
    expect(retry.urls).toEqual([shardUrl('0oaB')]);
    expect(outcome).toMatchObject({ complete: true, swept: 0 });
    await expect(storedShardKeys()).resolves.toEqual(['0oaA::00g1', '0oaB::00g2']);
    // Finished: the resume record is cleared so the next walk starts fresh.
    const meta = await orgSnapshotStore.getMeta('apps', ORIGIN);
    expect(meta.completedShards).toEqual([]);
    expect(meta.walkStartedAt).toBeNull();
  });

  it('sweeps an app that has dropped out of the org entirely', async () => {
    const first = scriptedRequest({
      [shardUrl('0oaA')]: { success: true, data: [{ id: '00g1' }], headers: {} },
      [shardUrl('0oaB')]: { success: true, data: [{ id: '00g2' }], headers: {} },
    });
    await runShardedWalk(shardedSpec(['0oaA', '0oaB']), {
      origin: ORIGIN,
      request: first.request,
      now: NOW,
    });

    // 0oaB is gone, so it is not in the shard list and never gets re-marked.
    // The shared mark is what lets one sweep notice that.
    const second = scriptedRequest({
      [shardUrl('0oaA')]: { success: true, data: [{ id: '00g1' }], headers: {} },
    });
    const outcome = await runShardedWalk(shardedSpec(['0oaA']), {
      origin: ORIGIN,
      request: second.request,
      now: NOW + 1000,
    });

    expect(outcome).toMatchObject({ complete: true, swept: 1 });
    await expect(storedShardKeys()).resolves.toEqual(['0oaA::00g1']);
  });

  it('records that it has no cheap mode, so the ladder gates it on its interval', async () => {
    const spec = shardedSpec(['0oaA']);
    const { request } = scriptedRequest({
      [shardUrl('0oaA')]: { success: true, data: [{ id: '00g1' }], headers: {} },
    });
    await runShardedWalk(spec, { origin: ORIGIN, request, now: NOW });

    // There is no org-wide count to drift-check a fan-out against and no listing
    // to filter by `lastUpdated`, so this is written rather than probed.
    const meta = await orgSnapshotStore.getMeta('apps', ORIGIN);
    expect(meta.deltaSupported).toBe(false);

    // And `syncCollection` therefore leaves it alone until the spec's interval
    // elapses, rather than re-walking every shard on every attempt.
    const idle = scriptedRequest({});
    const outcome = await syncCollection(spec, {
      origin: ORIGIN,
      request: idle.request,
      now: NOW + 60_000,
    });
    expect(outcome.mode).toBe('none');
    expect(idle.urls).toEqual([]);
  });

  it('reports a failure to discover its shards rather than sweeping the collection', async () => {
    const first = scriptedRequest({
      [shardUrl('0oaA')]: { success: true, data: [{ id: '00g1' }], headers: {} },
    });
    await runShardedWalk(shardedSpec(['0oaA']), {
      origin: ORIGIN,
      request: first.request,
      now: NOW,
    });

    const spec: CollectionSpec<{ id: string }> = {
      ...shardedSpec(['0oaA']),
      shards: async () => {
        throw new Error('inventory unreadable');
      },
    };
    const outcome = await runShardedWalk(spec, {
      origin: ORIGIN,
      request: first.request,
      now: NOW + 1000,
    });

    // An empty shard list must never be inferred from a failure to read one —
    // that would sweep the entire collection.
    expect(outcome).toMatchObject({ complete: false, written: 0, swept: 0 });
    await expect(storedShardKeys()).resolves.toEqual(['0oaA::00g1']);
  });
});
