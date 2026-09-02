/**
 * @module shared/snapshot/orgSnapshotStore.test
 * @description Unit tests for the IndexedDB-backed org snapshot.
 *
 * `fake-indexeddb` is not a dependency of this repo, so `idb`'s `openDB` is
 * mocked with a Map-backed stub implementing exactly the surface the store uses
 * — the approach `presetStore.test.ts` and `profileDisplayStore.test.ts` already
 * take. The store is deliberately written against a small surface
 * (`get`/`put`/`delete`/`getAllFromIndex`/`getAllKeysFromIndex`/`transaction`)
 * partly so this fake can stay honest.
 *
 * What these pin is the store's own contract: origin isolation, upsert-by-id,
 * `patchMeta` merging rather than resetting, and the fire-and-forget degradation
 * that turns a broken database into a live fetch rather than a broken panel.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SyncMeta } from './types';

/**
 * A Map-backed fake of the `idb` database, in a hoisted block so the (also
 * hoisted) `vi.mock('idb')` factory can close over it. Keys are the serialized
 * compound key; `control.failAll` lets a test drive the swallow-and-degrade
 * paths. `transaction` is re-wrapped in its own `vi.fn()` because this suite
 * (uniquely among the idb-fake suites) asserts on its call count.
 */
const { fakeDB, tables, control } = await vi.hoisted(async () => {
  const { createFakeIdb } = await import('@/test/factories/idb');
  /** Primary key for a value, mirroring the real stores' `keyPath`s. */
  const primaryKeyOf = (name: string, value: unknown): unknown[] => {
    const row = value as Record<string, string>;
    return name === 'syncMeta' ? [row.origin, row.collection] : [row.origin, row.id];
  };
  const { fakeDB: baseDB, tables, control } = createFakeIdb({ primaryKeyOf });
  const fakeDB = { ...baseDB, transaction: vi.fn(baseDB.transaction) };
  return { fakeDB, tables, control };
});

vi.mock('idb', () => ({ openDB: vi.fn(async () => fakeDB) }));

// Imported after the mock is registered so the singleton opens the fake DB.
import { orgSnapshotStore } from './orgSnapshotStore';

const ORIGIN = 'https://example.okta.com';
const OTHER = 'https://other.okta.com';
const NOW = 1_800_000_000_000;

interface FakeGroup {
  id: string;
  name: string;
}

/** `{ id, entity }` pairs in the shape `upsertMany` takes. */
function groups(...names: Array<[string, string]>): Array<{ id: string; entity: FakeGroup }> {
  return names.map(([id, name]) => ({ id, entity: { id, name } }));
}

beforeEach(() => {
  tables.clear();
  control.failAll = false;
  vi.clearAllMocks();
});

describe('entity round-trip', () => {
  it('stores and reads back the entity, unwrapped from its envelope', async () => {
    await orgSnapshotStore.upsertMany('groups', ORIGIN, groups(['00g1', 'Eng']), NOW);

    // The caller asked for the org's groups, not the storage bookkeeping.
    await expect(orgSnapshotStore.getCollection<FakeGroup>('groups', ORIGIN)).resolves.toEqual([
      { id: '00g1', name: 'Eng' },
    ]);
  });

  it('upserts by id rather than appending a second row', async () => {
    await orgSnapshotStore.upsertMany('groups', ORIGIN, groups(['00g1', 'Eng']), NOW);
    await orgSnapshotStore.upsertMany('groups', ORIGIN, groups(['00g1', 'Engineering']), NOW + 1);

    const stored = await orgSnapshotStore.getCollection<FakeGroup>('groups', ORIGIN);
    expect(stored).toEqual([{ id: '00g1', name: 'Engineering' }]);
  });

  it('writes a page in one transaction, not one per row', async () => {
    await orgSnapshotStore.upsertMany(
      'groups',
      ORIGIN,
      groups(['00g1', 'A'], ['00g2', 'B'], ['00g3', 'C']),
      NOW,
    );

    // A 200-row page issued as 200 awaited puts is the difference between a write
    // that keeps up with the walk and one that becomes the walk.
    expect(fakeDB.transaction).toHaveBeenCalledTimes(1);
    await expect(orgSnapshotStore.countCollection('groups', ORIGIN)).resolves.toBe(3);
  });

  it('does not open a transaction for an empty page', async () => {
    await orgSnapshotStore.upsertMany('groups', ORIGIN, [], NOW);
    expect(fakeDB.transaction).not.toHaveBeenCalled();
  });
});

describe('origin isolation', () => {
  it('never serves one org the other org rows', async () => {
    await orgSnapshotStore.upsertMany('groups', ORIGIN, groups(['00g1', 'Eng']), NOW);
    await orgSnapshotStore.upsertMany('groups', OTHER, groups(['00g9', 'Sales']), NOW);

    await expect(orgSnapshotStore.getCollection<FakeGroup>('groups', ORIGIN)).resolves.toEqual([
      { id: '00g1', name: 'Eng' },
    ]);
    await expect(orgSnapshotStore.getCollection<FakeGroup>('groups', OTHER)).resolves.toEqual([
      { id: '00g9', name: 'Sales' },
    ]);
  });

  it('keeps collections apart within one origin', async () => {
    await orgSnapshotStore.upsertMany('groups', ORIGIN, groups(['00g1', 'Eng']), NOW);
    await orgSnapshotStore.upsertMany('apps', ORIGIN, groups(['0oa1', 'Slack']), NOW);

    await expect(orgSnapshotStore.countCollection('groups', ORIGIN)).resolves.toBe(1);
    await expect(orgSnapshotStore.countCollection('apps', ORIGIN)).resolves.toBe(1);
  });

  it('clears one origin without touching the other', async () => {
    await orgSnapshotStore.upsertMany('groups', ORIGIN, groups(['00g1', 'Eng']), NOW);
    await orgSnapshotStore.upsertMany('apps', ORIGIN, groups(['0oa1', 'Slack']), NOW);
    await orgSnapshotStore.upsertMany('groups', OTHER, groups(['00g9', 'Sales']), NOW);
    await orgSnapshotStore.patchMeta('groups', ORIGIN, { complete: true });

    await orgSnapshotStore.clearOrigin(ORIGIN);

    await expect(orgSnapshotStore.countCollection('groups', ORIGIN)).resolves.toBe(0);
    await expect(orgSnapshotStore.countCollection('apps', ORIGIN)).resolves.toBe(0);
    await expect(orgSnapshotStore.countCollection('groups', OTHER)).resolves.toBe(1);
    // The meta record goes with the rows — a cleared origin must present as
    // never-synced, not as a complete snapshot of zero groups.
    expect((await orgSnapshotStore.getMeta('groups', ORIGIN)).complete).toBe(false);
  });
});

describe('getIds and deleteIds', () => {
  it('enumerates the stored ids for the reconciliation pass', async () => {
    await orgSnapshotStore.upsertMany('groups', ORIGIN, groups(['00g1', 'A'], ['00g2', 'B']), NOW);
    await orgSnapshotStore.upsertMany('groups', OTHER, groups(['00g9', 'Z']), NOW);

    const ids = await orgSnapshotStore.getIds('groups', ORIGIN);
    expect([...ids].sort()).toEqual(['00g1', '00g2']);
  });

  it('deletes only the named ids', async () => {
    await orgSnapshotStore.upsertMany(
      'groups',
      ORIGIN,
      groups(['00g1', 'A'], ['00g2', 'B'], ['00g3', 'C']),
      NOW,
    );

    await orgSnapshotStore.deleteIds('groups', ORIGIN, ['00g2']);

    const remaining = await orgSnapshotStore.getCollection<FakeGroup>('groups', ORIGIN);
    expect(remaining.map((g) => g.id).sort()).toEqual(['00g1', '00g3']);
  });
});

describe('sync meta', () => {
  it('reads a never-synced collection as an empty record, not as undefined', async () => {
    const meta = await orgSnapshotStore.getMeta('groups', ORIGIN);
    expect(meta).toMatchObject({
      origin: ORIGIN,
      collection: 'groups',
      complete: false,
      deltaSupported: null,
      itemCount: null,
    });
  });

  it('merges a patch instead of resetting the other axes', async () => {
    await orgSnapshotStore.patchMeta('groups', ORIGIN, {
      complete: true,
      lastFullWalkAt: NOW,
      watermark: '2026-08-24T09:00:00.000Z',
      itemCount: 1000,
    });

    // A probe touches one field. A blind whole-record put here would silently
    // wipe the watermark and the completion flag written by the walk.
    await orgSnapshotStore.patchMeta('groups', ORIGIN, { deltaSupported: true });

    const meta = await orgSnapshotStore.getMeta('groups', ORIGIN);
    expect(meta).toMatchObject({
      complete: true,
      lastFullWalkAt: NOW,
      watermark: '2026-08-24T09:00:00.000Z',
      itemCount: 1000,
      deltaSupported: true,
    });
  });

  it('keeps a cursor across a suspended walk so it can resume', async () => {
    await orgSnapshotStore.patchMeta('groups', ORIGIN, {
      cursor: '/api/v1/groups?limit=200&after=abc',
      complete: false,
    });

    const meta = await orgSnapshotStore.getMeta('groups', ORIGIN);
    expect(meta.cursor).toBe('/api/v1/groups?limit=200&after=abc');
    expect(meta.complete).toBe(false);
  });

  it('overwrites a failing walk’s status rather than leaving it stale (D-068)', async () => {
    // A 403-curtailed walk records its status alongside the rest of the outcome.
    await orgSnapshotStore.patchMeta('groups', ORIGIN, { complete: false, status: 403 });
    expect((await orgSnapshotStore.getMeta('groups', ORIGIN)).status).toBe(403);

    // A later walk that succeeds must clear it — an hour-old permission failure
    // must never keep claiming the credential still cannot read the collection.
    await orgSnapshotStore.patchMeta('groups', ORIGIN, {
      complete: true,
      lastFullWalkAt: NOW,
      status: null,
    });
    const meta = await orgSnapshotStore.getMeta('groups', ORIGIN);
    expect(meta.status).toBeNull();
    expect(meta.complete).toBe(true);
  });

  it('scopes meta per (origin, collection)', async () => {
    await orgSnapshotStore.patchMeta('groups', ORIGIN, { itemCount: 1000 });
    await orgSnapshotStore.patchMeta('groups', OTHER, { itemCount: 7 });
    await orgSnapshotStore.patchMeta('apps', ORIGIN, { itemCount: 42 });

    expect((await orgSnapshotStore.getMeta('groups', ORIGIN)).itemCount).toBe(1000);
    expect((await orgSnapshotStore.getMeta('groups', OTHER)).itemCount).toBe(7);
    expect((await orgSnapshotStore.getMeta('apps', ORIGIN)).itemCount).toBe(42);
  });
});

describe('a broken database degrades rather than throws', () => {
  it('reads as empty and reports never-synced', async () => {
    await orgSnapshotStore.upsertMany('groups', ORIGIN, groups(['00g1', 'Eng']), NOW);
    control.failAll = true;

    // The panel must fall back to a live fetch, not surface a database error.
    await expect(orgSnapshotStore.getCollection('groups', ORIGIN)).resolves.toEqual([]);
    await expect(orgSnapshotStore.countCollection('groups', ORIGIN)).resolves.toBe(0);
    await expect(orgSnapshotStore.getIds('groups', ORIGIN)).resolves.toEqual(new Set());

    // A failed meta read presents as never-synced, so the caller full-walks
    // rather than trusting a verdict it could not actually read.
    const meta = (await orgSnapshotStore.getMeta('groups', ORIGIN)) as SyncMeta;
    expect(meta.complete).toBe(false);
    expect(meta.lastFullWalkAt).toBeNull();
  });

  it('swallows a failed write', async () => {
    control.failAll = true;
    await expect(
      orgSnapshotStore.upsertMany('groups', ORIGIN, groups(['00g1', 'Eng']), NOW),
    ).resolves.toBeUndefined();
    await expect(orgSnapshotStore.deleteIds('groups', ORIGIN, ['00g1'])).resolves.toBeUndefined();
  });
});
