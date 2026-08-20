/**
 * @module shared/storage/profileDisplayStore.test
 * @description Unit tests for the IndexedDB-backed profile display config store.
 *
 * `fake-indexeddb` is not a dependency of this repo, so `idb`'s `openDB` is mocked
 * with a Map-backed in-memory stub implementing the three methods the store uses
 * (`get`/`put`/`delete`), matching the approach in `presetStore.test.ts`. These
 * tests pin the store's own contract: per-origin round-tripping, upsert-by-origin,
 * the `updatedAt`/`version` bookkeeping, clearing, and the fire-and-forget
 * behaviour that swallows DB errors and degrades a read to `null`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ProfileDisplayConfig, StoredProfileDisplay } from './profileDisplayStore';

// A Map-backed fake of the idb database, created in a hoisted block so the
// `vi.mock('idb')` factory (also hoisted) can close over it.
const { fakeDB, configs } = vi.hoisted(() => {
  const configs = new Map<string, StoredProfileDisplay>();
  const fakeDB = {
    get: vi.fn(
      async (_store: string, oktaOrigin: string): Promise<StoredProfileDisplay | undefined> =>
        configs.get(oktaOrigin),
    ),
    put: vi.fn(async (_store: string, value: StoredProfileDisplay): Promise<void> => {
      configs.set(value.oktaOrigin, value);
    }),
    delete: vi.fn(async (_store: string, oktaOrigin: string): Promise<void> => {
      configs.delete(oktaOrigin);
    }),
  };
  return { fakeDB, configs };
});

vi.mock('idb', () => ({ openDB: vi.fn(async () => fakeDB) }));

// Imported after the mock is registered so the singleton opens the fake DB.
import { profileDisplayStore, DEFAULT_PROFILE_DISPLAY_CONFIG } from './profileDisplayStore';

const ORIGIN = 'https://example.okta.com';
const OTHER_ORIGIN = 'https://other.okta.com';

function makeConfig(overrides: Partial<ProfileDisplayConfig> = {}): ProfileDisplayConfig {
  return {
    ...DEFAULT_PROFILE_DISPLAY_CONFIG,
    layout: 'grid',
    showApiNames: true,
    assign: { firstName: 'identity' },
    attrOrder: ['firstName', 'lastName'],
    hidden: { lastName: true },
    ...overrides,
  };
}

/** The raw record the fake DB holds for an origin; throws when there is none. */
function storedRecord(oktaOrigin: string): StoredProfileDisplay {
  const record = configs.get(oktaOrigin);
  if (!record) throw new Error('expected a stored record for this origin');
  return record;
}

/** Read a config through the store, asserting one was found. */
async function loadedConfig(oktaOrigin: string): Promise<ProfileDisplayConfig> {
  const config = await profileDisplayStore.getConfig(oktaOrigin);
  if (!config) throw new Error('expected a saved config for this origin');
  return config;
}

beforeEach(() => {
  vi.clearAllMocks();
  configs.clear();
});

describe('DEFAULT_PROFILE_DISPLAY_CONFIG', () => {
  it('starts with rows layout, rule chips on, and the five built-in categories', () => {
    expect(DEFAULT_PROFILE_DISPLAY_CONFIG.layout).toBe('rows');
    expect(DEFAULT_PROFILE_DISPLAY_CONFIG.showApiNames).toBe(false);
    expect(DEFAULT_PROFILE_DISPLAY_CONFIG.showRuleChips).toBe(true);
    expect(DEFAULT_PROFILE_DISPLAY_CONFIG.showEmpty).toBe(false);
    expect(DEFAULT_PROFILE_DISPLAY_CONFIG.categories.map((c) => c.key)).toEqual([
      'identity',
      'organization',
      'account-state',
      'contact-locale',
      'custom',
    ]);
  });
});

describe('saveConfig + getConfig', () => {
  it('round-trips a config for one origin', async () => {
    const config = makeConfig();
    await profileDisplayStore.saveConfig(ORIGIN, config);

    expect(await profileDisplayStore.getConfig(ORIGIN)).toEqual(config);
  });

  it('stores updatedAt and the per-record version alongside the config', async () => {
    await profileDisplayStore.saveConfig(ORIGIN, makeConfig());

    const record = storedRecord(ORIGIN);
    expect(record.oktaOrigin).toBe(ORIGIN);
    expect(record.updatedAt).toBeInstanceOf(Date);
    expect(record.version).toBe(1);
  });

  it('returns null for an origin that has never been configured', async () => {
    await profileDisplayStore.saveConfig(OTHER_ORIGIN, makeConfig());

    expect(await profileDisplayStore.getConfig(ORIGIN)).toBeNull();
  });

  it('keeps one record per origin, replacing on re-save', async () => {
    await profileDisplayStore.saveConfig(ORIGIN, makeConfig({ layout: 'rows' }));
    await profileDisplayStore.saveConfig(ORIGIN, makeConfig({ layout: 'compact' }));
    await profileDisplayStore.saveConfig(OTHER_ORIGIN, makeConfig({ layout: 'grid' }));

    expect(configs.size).toBe(2);
    expect((await loadedConfig(ORIGIN)).layout).toBe('compact');
    expect((await loadedConfig(OTHER_ORIGIN)).layout).toBe('grid');
  });

  it('persists placements verbatim, including attributes not in the schema', async () => {
    await profileDisplayStore.saveConfig(
      ORIGIN,
      makeConfig({
        assign: { firstName: 'identity', retiredAttr: 'custom' },
        attrOrder: ['firstName', 'retiredAttr'],
      }),
    );

    const loaded = await loadedConfig(ORIGIN);
    expect(loaded.assign.retiredAttr).toBe('custom');
    expect(loaded.attrOrder).toEqual(['firstName', 'retiredAttr']);
  });
});

describe('clearConfig', () => {
  it('removes the config for that origin so the next read is null', async () => {
    await profileDisplayStore.saveConfig(ORIGIN, makeConfig());
    await profileDisplayStore.clearConfig(ORIGIN);

    expect(await profileDisplayStore.getConfig(ORIGIN)).toBeNull();
  });

  it('leaves other origins untouched', async () => {
    await profileDisplayStore.saveConfig(ORIGIN, makeConfig());
    await profileDisplayStore.saveConfig(OTHER_ORIGIN, makeConfig());

    await profileDisplayStore.clearConfig(ORIGIN);

    expect(await profileDisplayStore.getConfig(OTHER_ORIGIN)).not.toBeNull();
  });
});

describe('failure handling', () => {
  it('degrades a failed read to null instead of throwing', async () => {
    fakeDB.get.mockRejectedValueOnce(new Error('db down'));

    await expect(profileDisplayStore.getConfig(ORIGIN)).resolves.toBeNull();
  });

  it('swallows a failed write', async () => {
    fakeDB.put.mockRejectedValueOnce(new Error('db down'));

    await expect(profileDisplayStore.saveConfig(ORIGIN, makeConfig())).resolves.toBeUndefined();
  });

  it('swallows a failed clear', async () => {
    fakeDB.delete.mockRejectedValueOnce(new Error('db down'));

    await expect(profileDisplayStore.clearConfig(ORIGIN)).resolves.toBeUndefined();
  });
});
