/**
 * @module test/factories/idb
 * @description Fake `idb` (`openDB`) factory for suites that back a Map-based
 * store in place of IndexedDB.
 *
 * `fake-indexeddb` is not a dependency of this repo, so every suite that
 * exercises an IndexedDB-backed store (`orgSnapshotStore`, and the hooks that
 * read through it) mocks `idb`'s `openDB` with a small Map-backed stub. Four
 * suites had hand-rolled the same object (D-042); this is the one
 * implementation they all build on.
 *
 * Usage — this must run inside a `vi.hoisted` block, because `vi.mock('idb', …)`
 * is itself hoisted above the file's imports and needs the fake to already
 * exist by the time its factory runs. A *static* `import` of this module at
 * the top of the test file is hoisted along with it and would throw "cannot
 * access before initialization", so `vi.hoisted` reaches for this module with
 * a dynamic `import()` instead — that resolves against the live module graph
 * at call time rather than being reordered with the rest of the file's
 * imports:
 *
 * ```ts
 * const { fakeDB, tables } = await vi.hoisted(async () => {
 *   const { createFakeIdb } = await import('@/test/factories/idb');
 *   return createFakeIdb();
 * });
 *
 * vi.mock('idb', () => ({ openDB: vi.fn(async () => fakeDB) }));
 * ```
 */

/** One named table: a plain `Map` keyed by the serialized compound key. */
type Table = Map<string, unknown>;

/** Shape every suite's `openDB` mock resolves to. */
export interface FakeIdb {
  get: (name: string, key: unknown) => Promise<unknown>;
  put: (name: string, value: unknown, key?: unknown) => Promise<unknown>;
  delete: (name: string, key: unknown) => Promise<void>;
  getAllFromIndex: (name: string, index: string, origin: string) => Promise<unknown[]>;
  getAllKeysFromIndex: (name: string, index: string, origin: string) => Promise<unknown[]>;
  transaction: (name: string) => {
    store: { put: (value: unknown) => Promise<void>; delete: (key: unknown) => Promise<void> };
    done: Promise<void>;
  };
}

/** Options controlling how much of the real `idb` surface the fake honors. */
export interface CreateFakeIdbOptions {
  /**
   * Compute the primary key `put`/`transaction().store.put` persist a row
   * under, mirroring the real store's `keyPath`. Defaults to treating `put` as
   * a no-op (the shape the read-only hook suites want — they seed rows
   * directly into `tables` and never assert a write round-trips). Pass this to
   * get real persistence, as `orgSnapshotStore.test.ts` does.
   */
  primaryKeyOf?: (name: string, value: unknown) => unknown;
}

const keyOf = (key: unknown): string => (Array.isArray(key) ? key.join('::') : String(key));

/**
 * Build a fresh Map-backed fake of the `idb` database plus the `tables` map
 * backing it, so a test can seed rows directly and a suite that wants failure
 * injection can flip `control.failAll`.
 *
 * @param options - See {@link CreateFakeIdbOptions}.
 * @returns `{ fakeDB, tables, control }` — `fakeDB` is what `openDB` should
 *   resolve to; `tables` is keyed by store name for direct seeding/inspection;
 *   `control.failAll`, when set `true`, makes every method reject as a real
 *   IndexedDB failure would (used to pin the swallow-and-degrade paths).
 */
export function createFakeIdb(options: CreateFakeIdbOptions = {}): {
  fakeDB: FakeIdb;
  tables: Map<string, Table>;
  control: { failAll: boolean };
} {
  const tables = new Map<string, Table>();
  const control = { failAll: false };

  const table = (name: string): Table => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name) as Table;
  };
  const guard = (): void => {
    if (control.failAll) throw new Error('IndexedDB unavailable');
  };
  const persist = (name: string, value: unknown): void => {
    const key = options.primaryKeyOf ? options.primaryKeyOf(name, value) : undefined;
    if (key !== undefined) table(name).set(keyOf(key), value);
  };

  const fakeDB: FakeIdb = {
    get: async (name, key) => {
      guard();
      return table(name).get(keyOf(key));
    },
    put: async (name, value) => {
      guard();
      persist(name, value);
    },
    delete: async (name, key) => {
      guard();
      table(name).delete(keyOf(key));
    },
    getAllFromIndex: async (name, _index, origin) => {
      guard();
      return [...table(name).values()].filter((v) => (v as { origin: string }).origin === origin);
    },
    getAllKeysFromIndex: async (name, _index, origin) => {
      guard();
      const primaryKeyOf = options.primaryKeyOf;
      if (!primaryKeyOf) return [];
      return [...table(name).values()]
        .filter((v) => (v as { origin: string }).origin === origin)
        .map((v) => primaryKeyOf(name, v));
    },
    transaction: (name) => {
      guard();
      return {
        store: {
          put: async (value: unknown) => {
            guard();
            persist(name, value);
          },
          delete: async (key: unknown) => {
            guard();
            table(name).delete(keyOf(key));
          },
        },
        done: Promise.resolve(),
      };
    },
  };

  return { fakeDB, tables, control };
}
