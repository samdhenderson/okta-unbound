/**
 * @module shared/storage/presetStore.test
 * @description Unit tests for the IndexedDB-backed export preset store.
 *
 * `fake-indexeddb` is not a dependency of this repo, so `idb`'s `openDB` is mocked
 * with a Map-backed in-memory stub implementing the four methods the store uses
 * (`get`/`put`/`delete`/`getAllFromIndex`). This keeps the test hermetic and
 * asserts the store's own logic: id/createdAt/version assignment, entity-scoped
 * newest-first listing, deletion, last-used upsert-by-entityId, and the
 * fire-and-forget contract that swallows DB errors and degrades reads to
 * `[]`/`null`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ExportPreset, LastUsed } from './presetStore';

// A Map-backed fake of the idb database, created in a hoisted block so the
// `vi.mock('idb')` factory (also hoisted) can close over it.
const { fakeDB, presets, lastUsed } = vi.hoisted(() => {
  const presets = new Map<string, ExportPreset>();
  const lastUsed = new Map<string, LastUsed>();
  const fakeDB = {
    getAllFromIndex: vi.fn(
      async (_store: string, _index: string, entityId: string): Promise<ExportPreset[]> =>
        [...presets.values()].filter((p) => p.entityId === entityId),
    ),
    put: vi.fn(async (store: string, value: ExportPreset | LastUsed): Promise<void> => {
      if (store === 'presets') presets.set((value as ExportPreset).id, value as ExportPreset);
      else lastUsed.set((value as LastUsed).entityId, value as LastUsed);
    }),
    delete: vi.fn(async (_store: string, id: string): Promise<void> => {
      presets.delete(id);
    }),
    get: vi.fn(async (_store: string, entityId: string): Promise<LastUsed | undefined> =>
      lastUsed.get(entityId),
    ),
  };
  return { fakeDB, presets, lastUsed };
});

vi.mock('idb', () => ({ openDB: vi.fn(async () => fakeDB) }));

// Imported after the mock is registered so the singleton opens the fake DB.
import { presetStore } from './presetStore';

beforeEach(() => {
  vi.clearAllMocks();
  presets.clear();
  lastUsed.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('savePreset + listPresets', () => {
  it('assigns id/createdAt/version and round-trips the preset', async () => {
    const saved = await presetStore.savePreset({
      entityId: 'users',
      name: 'Offboarding audit',
      enabledColumnIds: ['id', 'email'],
    });

    expect(saved).not.toBeNull();
    expect(typeof saved!.id).toBe('string');
    expect(saved!.id.length).toBeGreaterThan(0);
    expect(saved!.createdAt).toBeInstanceOf(Date);
    expect(saved!.version).toBe(1);

    const list = await presetStore.listPresets('users');
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Offboarding audit');
    expect(list[0].enabledColumnIds).toEqual(['id', 'email']);
  });

  it('lists only the given entity, newest first', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    await presetStore.savePreset({ entityId: 'users', name: 'older', enabledColumnIds: ['id'] });
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
    await presetStore.savePreset({ entityId: 'users', name: 'newer', enabledColumnIds: ['id'] });
    await presetStore.savePreset({ entityId: 'groups', name: 'other', enabledColumnIds: ['id'] });

    const list = await presetStore.listPresets('users');
    expect(list.map((p) => p.name)).toEqual(['newer', 'older']);
  });

  it('returns [] when the DB throws on read', async () => {
    fakeDB.getAllFromIndex.mockRejectedValueOnce(new Error('db down'));
    expect(await presetStore.listPresets('users')).toEqual([]);
  });

  it('returns null when the DB throws on save', async () => {
    fakeDB.put.mockRejectedValueOnce(new Error('db down'));
    const saved = await presetStore.savePreset({
      entityId: 'users',
      name: 'x',
      enabledColumnIds: [],
    });
    expect(saved).toBeNull();
  });
});

describe('deletePreset', () => {
  it('removes a saved preset', async () => {
    const saved = await presetStore.savePreset({
      entityId: 'users',
      name: 'temp',
      enabledColumnIds: ['id'],
    });
    expect(await presetStore.listPresets('users')).toHaveLength(1);

    await presetStore.deletePreset(saved!.id);
    expect(await presetStore.listPresets('users')).toHaveLength(0);
  });
});

describe('getLastUsed + setLastUsed', () => {
  it('returns null when there is no last-used row', async () => {
    expect(await presetStore.getLastUsed('users')).toBeNull();
  });

  it('returns the row after setLastUsed, upserting by entityId', async () => {
    await presetStore.setLastUsed('users', ['id', 'email']);
    // A second write for the same entity replaces the first (single row).
    await presetStore.setLastUsed('users', ['id', 'status']);

    const row = await presetStore.getLastUsed('users');
    expect(row).not.toBeNull();
    expect(row!.enabledColumnIds).toEqual(['id', 'status']);
    expect(row!.updatedAt).toBeInstanceOf(Date);
    expect(lastUsed.size).toBe(1);
  });

  it('returns null when the DB throws on read', async () => {
    fakeDB.get.mockRejectedValueOnce(new Error('db down'));
    expect(await presetStore.getLastUsed('users')).toBeNull();
  });
});
