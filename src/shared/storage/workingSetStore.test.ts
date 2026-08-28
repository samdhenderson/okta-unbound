/**
 * Unit tests for the Home tab's working set.
 *
 * Three things here are easy to regress and expensive to get wrong: the **origin
 * scoping**, because a leak across orgs shows one customer's group names to a
 * session connected to another; the **pinned/recent asymmetry**, because a pin
 * that quietly expires or a recent that never does are both failures the reader
 * only notices much later; and the **untrusted read**, because this file is
 * written by a past version of the extension and must degrade rather than throw.
 *
 * `chrome.storage.local` is the global `vi.fn()` mock from `src/test/setup.ts`,
 * backed here by an in-memory store so a write is visible to the next read —
 * the arrangement `undoManager.test.ts` uses.
 *
 * All ids and names are fake, per the repo's no-secrets rule.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  workingSetStore,
  normalizeFile,
  applyTouch,
  applyPin,
  applyUnpin,
  prune,
  WORKING_SET_STORAGE_KEY,
  RECENT_LIMIT,
  PINNED_LIMIT,
  RECENT_TTL_MS,
  EMPTY_WORKING_SET,
  type WorkingSet,
  type WorkingSetRef,
} from './workingSetStore';

const ORG_A = 'https://a.example.okta.com';
const ORG_B = 'https://b.example.okta.com';

const NOW = 1_800_000_000_000;

const storage = chrome.storage.local as unknown as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

let store: Record<string, unknown> = {};

beforeEach(() => {
  vi.clearAllMocks();
  store = {};
  storage.get.mockImplementation(async (key: string) =>
    key in store ? { [key]: store[key] } : {},
  );
  storage.set.mockImplementation(async (items: Record<string, unknown>) => {
    Object.assign(store, items);
  });
});

/** A group reference, minus the timestamp the store stamps on. */
const group = (id: string, name = 'Engineering') => ({ kind: 'group' as const, id, name });
const user = (id: string, name = 'Ada Lovelace') => ({ kind: 'user' as const, id, name });

/** A complete reference, for the pure helpers. */
const ref = (over: Partial<WorkingSetRef> = {}): WorkingSetRef => ({
  kind: 'group',
  id: '00gFAKE0000000000001',
  name: 'Engineering',
  lastSeenAt: NOW,
  ...over,
});

const set = (over: Partial<WorkingSet> = {}): WorkingSet => ({ ...EMPTY_WORKING_SET, ...over });

describe('normalizeFile', () => {
  it.each([undefined, null, 42, 'nonsense', {}, { version: 2, origins: {} }])(
    'returns an empty file for %p rather than throwing',
    (raw) => {
      expect(normalizeFile(raw)).toEqual({ version: 1, origins: {} });
    },
  );

  it('drops entries that are not shaped like references', () => {
    // A half-written blob must cost the reader the bad rows, not the tab.
    const file = normalizeFile({
      version: 1,
      origins: {
        [ORG_A]: {
          pinned: [ref(), { kind: 'group' }, null, { kind: 'policy', id: 'x', name: 'y' }],
          recent: 'not an array',
        },
      },
    });
    expect(file.origins[ORG_A].pinned).toEqual([ref()]);
    expect(file.origins[ORG_A].recent).toEqual([]);
  });

  it('caps an over-long stored list rather than trusting it', () => {
    const many = Array.from({ length: 40 }, (_, i) => ref({ id: `00gFAKE000000000000${i}` }));
    const file = normalizeFile({
      version: 1,
      origins: { [ORG_A]: { pinned: many, recent: many } },
    });
    expect(file.origins[ORG_A].pinned).toHaveLength(PINNED_LIMIT);
    expect(file.origins[ORG_A].recent).toHaveLength(RECENT_LIMIT);
  });
});

describe('applyTouch', () => {
  it('puts the newest visit first and de-duplicates the entity', () => {
    const first = applyTouch(set(), ref({ id: 'g1' }));
    const second = applyTouch(first, ref({ id: 'g2' }));
    const again = applyTouch(second, ref({ id: 'g1', lastSeenAt: NOW + 1 }));
    expect(again.recent.map((r) => r.id)).toEqual(['g1', 'g2']);
  });

  it(`keeps at most ${RECENT_LIMIT} recents, dropping the oldest`, () => {
    let current = set();
    for (let i = 0; i <= RECENT_LIMIT; i += 1) current = applyTouch(current, ref({ id: `g${i}` }));
    expect(current.recent).toHaveLength(RECENT_LIMIT);
    expect(current.recent.map((r) => r.id)).not.toContain('g0');
  });

  it('refreshes a pinned entity in place instead of also listing it as recent', () => {
    // Listing it twice would spend the reader's attention to say one thing.
    const pinned = applyPin(set(), ref({ name: 'Engineering' }));
    const touched = applyTouch(pinned, ref({ name: 'Engineering (renamed)', lastPane: 'members' }));
    expect(touched.recent).toEqual([]);
    expect(touched.pinned).toEqual([ref({ name: 'Engineering (renamed)', lastPane: 'members' })]);
  });

  it('separates the two kinds — a group and a user may share an id', () => {
    const both = applyTouch(
      applyTouch(set(), ref({ kind: 'group', id: 'x' })),
      ref({ kind: 'user', id: 'x' }),
    );
    expect(both.recent).toHaveLength(2);
  });
});

describe('applyPin / applyUnpin', () => {
  it('moves the entity out of recent, so it is listed once', () => {
    const touched = applyTouch(set(), ref());
    const pinned = applyPin(touched, ref());
    expect(pinned.pinned).toHaveLength(1);
    expect(pinned.recent).toEqual([]);
  });

  it('is idempotent — pinning twice does not duplicate the row', () => {
    const once = applyPin(set(), ref());
    expect(applyPin(once, ref())).toBe(once);
  });

  it(`refuses beyond ${PINNED_LIMIT}, rather than growing a plaintext file without bound`, () => {
    let current = set();
    for (let i = 0; i < PINNED_LIMIT + 3; i += 1) current = applyPin(current, ref({ id: `g${i}` }));
    expect(current.pinned).toHaveLength(PINNED_LIMIT);
  });

  it('does not put an unpinned entity back into recent', () => {
    // The reader just said they were done with it; re-listing it one row lower
    // would argue with them.
    const pinned = applyPin(set(), ref());
    expect(applyUnpin(pinned, ref())).toEqual(EMPTY_WORKING_SET);
  });
});

describe('prune', () => {
  it('expires a recent that has not been seen inside the window', () => {
    const stale = set({ recent: [ref({ lastSeenAt: NOW - RECENT_TTL_MS - 1 })] });
    expect(prune(stale, NOW).recent).toEqual([]);
  });

  it('keeps one seen just inside it', () => {
    const fresh = set({ recent: [ref({ lastSeenAt: NOW - RECENT_TTL_MS + 1 })] });
    expect(prune(fresh, NOW).recent).toHaveLength(1);
  });

  it('never expires a pin — it is a decision, not a by-product of browsing', () => {
    const old = set({ pinned: [ref({ lastSeenAt: NOW - RECENT_TTL_MS * 100 })] });
    expect(prune(old, NOW).pinned).toHaveLength(1);
  });
});

describe('the store', () => {
  it('returns an empty set with no origin, rather than some other org’s rows', async () => {
    await workingSetStore.touch(ORG_A, group('00gFAKE0000000000001'), NOW);
    expect(await workingSetStore.read(null)).toEqual(EMPTY_WORKING_SET);
    expect(await workingSetStore.read(undefined)).toEqual(EMPTY_WORKING_SET);
  });

  it('never writes without an origin', async () => {
    await workingSetStore.touch(null, group('00gFAKE0000000000001'), NOW);
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('keeps two orgs apart', async () => {
    // The failure this guards is quieter than the snapshot's, and the same
    // class: a name from an org this session is not entitled to see.
    await workingSetStore.touch(ORG_A, group('00gFAKE0000000000001', 'Org A group'), NOW);
    await workingSetStore.touch(ORG_B, group('00gFAKE0000000000002', 'Org B group'), NOW);

    expect((await workingSetStore.read(ORG_A, NOW)).recent.map((r) => r.name)).toEqual([
      'Org A group',
    ]);
    expect((await workingSetStore.read(ORG_B, NOW)).recent.map((r) => r.name)).toEqual([
      'Org B group',
    ]);
  });

  it('clears one org without touching the other', async () => {
    await workingSetStore.touch(ORG_A, group('00gFAKE0000000000001'), NOW);
    await workingSetStore.touch(ORG_B, group('00gFAKE0000000000002'), NOW);
    await workingSetStore.clearOrigin(ORG_A);

    expect(await workingSetStore.read(ORG_A, NOW)).toEqual(EMPTY_WORKING_SET);
    expect((await workingSetStore.read(ORG_B, NOW)).recent).toHaveLength(1);
  });

  it('toggles a pin on and back off', async () => {
    const id = '00uFAKE0000000000001';
    const on = await workingSetStore.togglePin(ORG_A, user(id), NOW);
    expect(on.pinned.map((r) => r.id)).toEqual([id]);
    const off = await workingSetStore.togglePin(ORG_A, user(id), NOW);
    expect(off.pinned).toEqual([]);
  });

  it('forgets an entity from both lists at once', async () => {
    await workingSetStore.touch(ORG_A, group('g1'), NOW);
    await workingSetStore.togglePin(ORG_A, group('g2'), NOW);
    const after = await workingSetStore.forget(ORG_A, { kind: 'group', id: 'g2' }, NOW);
    expect(after.pinned).toEqual([]);
    expect(after.recent.map((r) => r.id)).toEqual(['g1']);
  });

  it('persists the expiry it applies on read, rather than re-deciding it each time', async () => {
    await workingSetStore.touch(ORG_A, group('g1'), NOW);
    storage.set.mockClear();
    await workingSetStore.read(ORG_A, NOW + RECENT_TTL_MS + 1);
    expect(storage.set).toHaveBeenCalledTimes(1);
    expect(await workingSetStore.read(ORG_A, NOW + RECENT_TTL_MS + 1)).toEqual(EMPTY_WORKING_SET);
  });

  it('does not rewrite storage when nothing expired', async () => {
    await workingSetStore.touch(ORG_A, group('g1'), NOW);
    storage.set.mockClear();
    await workingSetStore.read(ORG_A, NOW + 1000);
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('degrades to an empty set when the read throws', async () => {
    storage.get.mockRejectedValueOnce(new Error('storage unavailable'));
    expect(await workingSetStore.read(ORG_A, NOW)).toEqual(EMPTY_WORKING_SET);
  });

  it('stores only the four fields a row needs', async () => {
    // `chrome.storage` is plaintext. A row carries the least that will render
    // it and nothing that would make the file worth reading.
    await workingSetStore.touch(ORG_A, { ...group('g1'), lastPane: 'members' }, NOW);
    const file = store[WORKING_SET_STORAGE_KEY] as { origins: Record<string, WorkingSet> };
    expect(Object.keys(file.origins[ORG_A].recent[0]).sort()).toEqual([
      'id',
      'kind',
      'lastPane',
      'lastSeenAt',
      'name',
    ]);
  });
});
