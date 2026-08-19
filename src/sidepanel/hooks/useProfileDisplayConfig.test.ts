/**
 * @module sidepanel/hooks/useProfileDisplayConfig.test
 * @description Unit tests for the profile-display-config hook.
 *
 * `idb` — not {@link module:shared/storage/profileDisplayStore} — is faked here, so
 * the real store runs underneath the hook and both contracts are exercised
 * together: a genuine save/load round-trip through the store, and the hook's own
 * reconciliation of persisted placements against the attributes that currently
 * exist. Persisted writes are coalesced behind a timer, so the tests drive fake
 * timers to reach them.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type {
  ProfileDisplayConfig,
  StoredProfileDisplay,
} from '@/shared/storage/profileDisplayStore';

// Map-backed fake of the idb database, hoisted so the (also hoisted)
// `vi.mock('idb')` factory can close over it.
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

import { useProfileDisplayConfig } from './useProfileDisplayConfig';
import { DEFAULT_PROFILE_DISPLAY_CONFIG } from '@/shared/storage/profileDisplayStore';

const ORIGIN = 'https://example.okta.com';
const ATTRS = ['firstName', 'lastName', 'department'];

/** Seed the fake DB with a saved config for `ORIGIN`, as a previous session would. */
function seed(config: Partial<ProfileDisplayConfig>): void {
  configs.set(ORIGIN, {
    oktaOrigin: ORIGIN,
    config: { ...DEFAULT_PROFILE_DISPLAY_CONFIG, ...config },
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    version: 1,
  });
}

/** Render the hook and let the initial (async) load settle. */
async function renderLoaded(oktaOrigin: string | null, attrs: readonly string[] = ATTRS) {
  const view = renderHook(() => useProfileDisplayConfig(oktaOrigin, [...attrs]));
  await act(async () => {});
  return view;
}

/** The config the fake DB holds for `ORIGIN`; throws when nothing was written. */
function savedConfig(): ProfileDisplayConfig {
  const record = configs.get(ORIGIN);
  if (!record) throw new Error('expected a persisted config for this origin');
  return record.config;
}

/** Run out the write-coalescing timer and let the resulting save settle. */
async function flushWrites(): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
  await act(async () => {});
}

beforeEach(() => {
  vi.clearAllMocks();
  configs.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('loading', () => {
  it('starts on the defaults and reports loaded once the org config is read', async () => {
    const { result } = renderHook(() => useProfileDisplayConfig(ORIGIN, [...ATTRS]));

    expect(result.current.isLoaded).toBe(false);
    expect(result.current.config.layout).toBe('rows');

    await act(async () => {});
    expect(result.current.isLoaded).toBe(true);
  });

  it('round-trips a saved config: an update is persisted and read back by a fresh mount', async () => {
    const first = await renderLoaded(ORIGIN);

    act(() => {
      first.result.current.update({ layout: 'grid', showApiNames: true });
    });
    await flushWrites();
    first.unmount();

    const { result } = await renderLoaded(ORIGIN);
    expect(result.current.config.layout).toBe('grid');
    expect(result.current.config.showApiNames).toBe(true);
  });

  it('coalesces rapid edits into a single write', async () => {
    const { result } = await renderLoaded(ORIGIN);

    act(() => {
      result.current.update({ categories: [{ key: 'custom', name: 'C' }] });
      result.current.update({ categories: [{ key: 'custom', name: 'Cu' }] });
      result.current.update({ categories: [{ key: 'custom', name: 'Cust' }] });
    });
    await flushWrites();

    expect(fakeDB.put).toHaveBeenCalledTimes(1);
    expect(savedConfig().categories[0].name).toBe('Cust');
  });
});

describe('reconciliation against the current attributes', () => {
  it('appends an attribute with no saved placement as uncategorized, in the order given', async () => {
    seed({ attrOrder: ['lastName'], assign: { lastName: 'identity' } });

    const { result } = await renderLoaded(ORIGIN);

    expect(result.current.config.attrOrder).toEqual(['lastName', 'firstName', 'department']);
    expect(result.current.config.assign.firstName).toBe('');
    expect(result.current.config.assign.department).toBe('');
  });

  it('hides an attribute that is not in the schema but keeps it in storage', async () => {
    seed({
      attrOrder: ['firstName', 'retiredAttr', 'lastName'],
      assign: { firstName: 'identity', retiredAttr: 'custom' },
      hidden: { retiredAttr: true },
    });

    const { result } = await renderLoaded(ORIGIN);

    // Not rendered: absent from every reconciled collection.
    expect(result.current.config.attrOrder).not.toContain('retiredAttr');
    expect(result.current.config.assign.retiredAttr).toBeUndefined();
    expect(result.current.config.hidden.retiredAttr).toBeUndefined();

    // Still retained: a later write from the reconciled view must not drop it.
    act(() => {
      result.current.update({
        attrOrder: ['lastName', 'firstName', 'department'],
        assign: { ...result.current.config.assign, lastName: 'organization' },
      });
    });
    await flushWrites();

    const saved = savedConfig();
    expect(saved.attrOrder).toContain('retiredAttr');
    expect(saved.assign.retiredAttr).toBe('custom');
    expect(saved.hidden.retiredAttr).toBe(true);
    // …and the admin's new ordering of the known attributes survived the merge.
    expect(saved.attrOrder.filter((name) => name !== 'retiredAttr')).toEqual([
      'lastName',
      'firstName',
      'department',
    ]);
  });

  it('falls back to uncategorized when the saved category no longer exists', async () => {
    seed({ assign: { department: 'deleted-key' }, attrOrder: ['department'] });

    const { result } = await renderLoaded(ORIGIN);

    expect(result.current.config.assign.department).toBe('');
    expect(result.current.config.attrOrder).toContain('department');
  });

  it('returns a deleted category’s attributes to uncategorized rather than hiding them', async () => {
    seed({ assign: { department: 'organization', firstName: 'identity' } });
    const { result } = await renderLoaded(ORIGIN);
    expect(result.current.config.assign.department).toBe('organization');

    act(() => {
      result.current.update({
        categories: DEFAULT_PROFILE_DISPLAY_CONFIG.categories.filter(
          (category) => category.key !== 'organization',
        ),
      });
    });

    expect(result.current.config.assign.department).toBe('');
    expect(result.current.config.attrOrder).toContain('department');
    expect(result.current.config.hidden.department).toBeUndefined();
    expect(result.current.config.assign.firstName).toBe('identity');
  });
});

describe('reset', () => {
  it('restores the defaults and clears the stored config', async () => {
    seed({ layout: 'compact', showRuleChips: false, assign: { firstName: 'custom' } });
    const { result } = await renderLoaded(ORIGIN);
    expect(result.current.config.layout).toBe('compact');

    act(() => {
      result.current.reset();
    });
    await act(async () => {});

    expect(result.current.config.layout).toBe('rows');
    expect(result.current.config.showRuleChips).toBe(true);
    expect(result.current.config.assign.firstName).toBe('');
    expect(configs.has(ORIGIN)).toBe(false);
  });
});

describe('no origin', () => {
  it('returns reconciled defaults and never touches storage', async () => {
    const { result } = await renderLoaded(null);

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.config.layout).toBe('rows');
    expect(result.current.config.attrOrder).toEqual([...ATTRS]);

    act(() => {
      result.current.update({ layout: 'grid' });
    });
    await flushWrites();

    expect(result.current.config.layout).toBe('grid');
    expect(fakeDB.get).not.toHaveBeenCalled();
    expect(fakeDB.put).not.toHaveBeenCalled();
    expect(fakeDB.delete).not.toHaveBeenCalled();
  });
});

describe('storage failure', () => {
  it('degrades to the defaults instead of throwing when the read rejects', async () => {
    fakeDB.get.mockRejectedValueOnce(new Error('db down'));

    const { result } = await renderLoaded(ORIGIN);

    expect(result.current.isLoaded).toBe(true);
    expect(result.current.config.layout).toBe('rows');
    expect(result.current.config.attrOrder).toEqual([...ATTRS]);
  });
});
