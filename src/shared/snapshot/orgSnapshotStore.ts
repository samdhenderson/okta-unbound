/**
 * @module shared/snapshot/orgSnapshotStore
 * @description IndexedDB-backed org inventory, owned by the background worker
 * (ADR-0040).
 *
 * Holds the org's groups, apps, rules and app-group assignments scoped by **org
 * origin**, plus a {@link SyncMeta} record per `(origin, collection)` recording
 * how fresh each collection is and which sync mode it is due for.
 *
 * Follows the {@link module:shared/storage/auditStore} pattern: the database is
 * opened lazily on first use and the connection reused, the module exports a
 * singleton, and **every failure is logged and swallowed** rather than
 * propagated. A snapshot is an optimisation; a broken database must degrade the
 * panel to a live fetch, never break it. Reads therefore degrade to `[]`/`null`
 * and writes to a no-op.
 *
 * @see {@link module:shared/snapshot/syncMeta} for the pure freshness decisions.
 * @see {@link module:shared/snapshot/parseVersion} for `SyncMeta.parseVersion`,
 * which records what a collection's stored rows were walked with (ADR-0066).
 * The store persists it like any other meta field — `DB_VERSION` stays at `1`,
 * because a parse-version mismatch is resolved by re-reading the collection, not
 * by migrating the database.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { createLogger } from '../utils/logger';
import { emptySyncMeta } from './syncMeta';
import {
  SNAPSHOT_COLLECTIONS,
  type SnapshotCollection,
  type SnapshotRecord,
  type SyncMeta,
} from './types';

const log = createLogger('OrgSnapshotStore');

const DB_NAME = 'okta-unbound-snapshot';
const DB_VERSION = 1;
const META_STORE = 'syncMeta';

/** Compound primary key for an entity row: `[origin, id]`. */
type EntityKey = [string, string];
/** Compound primary key for a meta row: `[origin, collection]`. */
type MetaKey = [string, string];

interface EntityStore {
  key: EntityKey;
  value: SnapshotRecord;
  indexes: { origin: string };
}

interface SnapshotDB extends DBSchema {
  groups: EntityStore;
  apps: EntityStore;
  rules: EntityStore;
  appGroups: EntityStore;
  syncMeta: { key: MetaKey; value: SyncMeta };
}

/**
 * A caught value reduced to a loggable reason.
 *
 * These failures come from IndexedDB rather than from Okta, so the risk of a
 * payload riding along is low — but forwarding a raw caught value is the habit
 * that leaks one, and a later edit copying this line into a `log.error` (which
 * ships) would do exactly that. Same discipline as `snapshotSync`'s walk failure
 * and `parseOktaList`'s "never log the offending item".
 *
 * @param error - The caught value.
 * @returns Its message, or a fixed label for a non-`Error` throw.
 */
function errorReason(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}

/**
 * The org snapshot. Prefer the exported {@link orgSnapshotStore} singleton over
 * constructing instances — the connection is per-instance and there is no reason
 * to hold two.
 */
class OrgSnapshotStore {
  private dbPromise: Promise<IDBPDatabase<SnapshotDB>> | null = null;

  private async getDB(): Promise<IDBPDatabase<SnapshotDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<SnapshotDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          for (const collection of SNAPSHOT_COLLECTIONS) {
            if (!db.objectStoreNames.contains(collection)) {
              const store = db.createObjectStore(collection, { keyPath: ['origin', 'id'] });
              // Every read is "this origin's rows"; the compound primary key
              // alone cannot serve that without a key range, and a key range
              // would drag IDBKeyRange into environments that lack it.
              store.createIndex('origin', 'origin');
            }
          }
          if (!db.objectStoreNames.contains(META_STORE)) {
            db.createObjectStore(META_STORE, { keyPath: ['origin', 'collection'] });
          }
        },
      });
    }
    return this.dbPromise;
  }

  /**
   * Every stored entity of one collection for one org.
   *
   * @param collection - Which collection to read.
   * @param origin - Org origin.
   * @returns The stored entities, newest write order not guaranteed; `[]` on any
   * failure (logged, never thrown).
   * @remarks Returns the entities themselves, unwrapped from their
   * {@link SnapshotRecord} envelope — callers want the org's groups, not the
   * storage bookkeeping. Use {@link countCollection} when only the size matters.
   */
  async getCollection<T>(collection: SnapshotCollection, origin: string): Promise<T[]> {
    try {
      const db = await this.getDB();
      const rows = await db.getAllFromIndex(collection, 'origin', origin);
      return rows.map((row) => row.entity as T);
    } catch (error) {
      log.error('Failed to read collection', { code: 'snapshot_read_failed', collection });
      log.debug('Snapshot read error detail', { reason: errorReason(error) });
      return [];
    }
  }

  /**
   * Every stored **record** of one collection for one org, envelope included.
   *
   * The counterpart to {@link getCollection}, for the one case where the
   * envelope carries meaning: a collection whose key is composed rather than
   * copied from `row.id`. `appGroups` keys rows `${appId}::${groupId}` because
   * Okta returns only the group's id on an assignment, so the app the assignment
   * belongs to exists *in the key* and nowhere in the entity.
   *
   * Prefer {@link getCollection} everywhere else — callers want the org's
   * groups, not the storage bookkeeping.
   *
   * @param collection - Which collection to read.
   * @param origin - Org origin.
   * @returns The stored records; `[]` on any failure (logged, never thrown).
   */
  async getRecords<T>(
    collection: SnapshotCollection,
    origin: string,
  ): Promise<SnapshotRecord<T>[]> {
    try {
      const db = await this.getDB();
      const rows = await db.getAllFromIndex(collection, 'origin', origin);
      return rows as SnapshotRecord<T>[];
    } catch (error) {
      log.error('Failed to read collection records', {
        code: 'snapshot_read_failed',
        collection,
      });
      log.debug('Snapshot read error detail', { reason: errorReason(error) });
      return [];
    }
  }

  /**
   * How many rows one org has stored for a collection.
   *
   * @param collection - Which collection to size.
   * @param origin - Org origin.
   * @returns The row count; `0` on failure.
   * @remarks This is the left-hand side of the drift check, so it must count what
   * is actually stored rather than trusting {@link SyncMeta.itemCount} — the
   * whole point of the check is to catch the two disagreeing.
   */
  async countCollection(collection: SnapshotCollection, origin: string): Promise<number> {
    try {
      const db = await this.getDB();
      return (await db.getAllKeysFromIndex(collection, 'origin', origin)).length;
    } catch (error) {
      log.error('Failed to count collection', { code: 'snapshot_count_failed', collection });
      log.debug('Snapshot count error detail', { reason: errorReason(error) });
      return 0;
    }
  }

  /**
   * Insert or update rows for one org, in a single transaction.
   *
   * @param collection - Target collection.
   * @param origin - Org origin.
   * @param entities - Validated entities keyed by their Okta id.
   * @param now - Epoch millis stamped onto each row; injected so callers can
   * keep a page's rows on one timestamp and so tests stay deterministic.
   * @remarks One transaction per page, not per row: a 200-row page issued as 200
   * awaited puts is the difference between a write that keeps up with the walk
   * and one that becomes the walk's bottleneck.
   */
  async upsertMany<T>(
    collection: SnapshotCollection,
    origin: string,
    entities: ReadonlyArray<{ id: string; entity: T }>,
    now: number,
  ): Promise<void> {
    if (entities.length === 0) return;
    try {
      const db = await this.getDB();
      const tx = db.transaction(collection, 'readwrite');
      await Promise.all(
        entities.map(({ id, entity }) =>
          tx.store.put({ origin, id, entity, syncedAt: now } as SnapshotRecord),
        ),
      );
      await tx.done;
    } catch (error) {
      log.error('Failed to upsert rows', {
        code: 'snapshot_upsert_failed',
        collection,
        count: entities.length,
      });
      log.debug('Snapshot upsert error detail', { reason: errorReason(error) });
    }
  }

  /**
   * Drop rows this org no longer has.
   *
   * @param collection - Target collection.
   * @param origin - Org origin.
   * @param ids - Okta ids to remove.
   * @remarks Used to reconcile a full walk: ids present in the store but absent
   * from the walk have been deleted in Okta. Deletion is the one change a delta
   * can never observe (ADR-0040 §3), so this is only ever driven by a full walk
   * or an explicit invalidation — never inferred from a delta's silence.
   */
  async deleteIds(
    collection: SnapshotCollection,
    origin: string,
    ids: ReadonlyArray<string>,
  ): Promise<void> {
    if (ids.length === 0) return;
    try {
      const db = await this.getDB();
      const tx = db.transaction(collection, 'readwrite');
      await Promise.all(ids.map((id) => tx.store.delete([origin, id] as EntityKey)));
      await tx.done;
    } catch (error) {
      log.error('Failed to delete rows', {
        code: 'snapshot_delete_failed',
        collection,
        count: ids.length,
      });
      log.debug('Snapshot delete error detail', { reason: errorReason(error) });
    }
  }

  /**
   * Drop every row a completed full walk did not touch.
   *
   * @param collection - Target collection.
   * @param origin - Org origin.
   * @param walkStartedAt - The walk's mark; rows stamped earlier are swept.
   * @returns How many rows were swept.
   * @remarks The **sweep** half of the walk's mark-and-sweep reconciliation. A
   * full walk returns every row the org still has, so a row carrying an older
   * `syncedAt` was not returned and therefore no longer exists in Okta. Deletion
   * is the one change a delta can never observe (ADR-0040 §3), which is why it is
   * only ever concluded here, from a walk that is known to have completed — never
   * inferred from a delta's silence.
   *
   * Sweeping by timestamp rather than by a set of seen ids is what makes a
   * **resumed** walk correct: the resumed pages carry the original walk's mark,
   * so the sweep still covers rows the interrupted pages had returned.
   */
  async sweepStale(
    collection: SnapshotCollection,
    origin: string,
    walkStartedAt: number,
  ): Promise<number> {
    try {
      const db = await this.getDB();
      const rows = await db.getAllFromIndex(collection, 'origin', origin);
      const stale = rows.filter((row) => row.syncedAt < walkStartedAt).map((row) => row.id);
      await this.deleteIds(collection, origin, stale);
      return stale.length;
    } catch (error) {
      log.error('Failed to sweep stale rows', { code: 'snapshot_sweep_failed', collection });
      log.debug('Snapshot sweep error detail', { reason: errorReason(error) });
      return 0;
    }
  }

  /**
   * The ids one org currently has stored for a collection.
   *
   * @param collection - Which collection to enumerate.
   * @param origin - Org origin.
   * @returns The stored ids as a `Set`; empty on failure.
   * @remarks Reconciliation does **not** use this — it sweeps by timestamp (see
   * {@link sweepStale}). This serves {@link clearOrigin} and diagnostics.
   */
  async getIds(collection: SnapshotCollection, origin: string): Promise<Set<string>> {
    try {
      const db = await this.getDB();
      const keys = await db.getAllKeysFromIndex(collection, 'origin', origin);
      return new Set(keys.map((key) => (key as EntityKey)[1]));
    } catch (error) {
      log.error('Failed to read ids', { code: 'snapshot_ids_failed', collection });
      log.debug('Snapshot id read error detail', { reason: errorReason(error) });
      return new Set();
    }
  }

  /**
   * Read a collection's sync bookkeeping.
   *
   * @param collection - Which collection.
   * @param origin - Org origin.
   * @returns The stored record, or a fresh {@link emptySyncMeta} when none exists
   * — including when the read failed, so a broken database presents as "never
   * synced" and the caller full-walks rather than trusting a stale verdict.
   */
  async getMeta(collection: SnapshotCollection, origin: string): Promise<SyncMeta> {
    try {
      const db = await this.getDB();
      const stored = await db.get(META_STORE, [origin, collection] as MetaKey);
      return stored ?? emptySyncMeta(origin, collection);
    } catch (error) {
      log.error('Failed to read sync meta', { code: 'snapshot_meta_read_failed', collection });
      log.debug('Snapshot meta read error detail', { reason: errorReason(error) });
      return emptySyncMeta(origin, collection);
    }
  }

  /**
   * Merge a patch into a collection's sync bookkeeping.
   *
   * @param collection - Which collection.
   * @param origin - Org origin.
   * @param patch - Fields to change; everything else is preserved.
   * @returns The record as written, so a caller can act on it without re-reading;
   * on failure, the merged value it attempted to write.
   * @remarks A read-modify-write rather than a whole-record put, because callers
   * update one axis at a time (a page advances `cursor` and `watermark`; a probe
   * sets only `deltaSupported`) and a blind put would silently reset the others.
   */
  async patchMeta(
    collection: SnapshotCollection,
    origin: string,
    patch: Partial<Omit<SyncMeta, 'origin' | 'collection'>>,
  ): Promise<SyncMeta> {
    const current = await this.getMeta(collection, origin);
    const merged: SyncMeta = { ...current, ...patch, origin, collection };
    try {
      const db = await this.getDB();
      await db.put(META_STORE, merged);
    } catch (error) {
      log.error('Failed to write sync meta', { code: 'snapshot_meta_write_failed', collection });
      log.debug('Snapshot meta write error detail', { reason: errorReason(error) });
    }
    return merged;
  }

  /**
   * Remove every row and every meta record for one org.
   *
   * @param origin - Org origin to forget.
   * @remarks The panel calls this when the connected org changes and on an
   * explicit clear. One org's inventory must never outlive the session that is
   * entitled to see it, and IndexedDB is plaintext (`docs/security.md`).
   */
  async clearOrigin(origin: string): Promise<void> {
    for (const collection of SNAPSHOT_COLLECTIONS) {
      const ids = await this.getIds(collection, origin);
      await this.deleteIds(collection, origin, [...ids]);
      try {
        const db = await this.getDB();
        await db.delete(META_STORE, [origin, collection] as MetaKey);
      } catch (error) {
        log.error('Failed to clear sync meta', { code: 'snapshot_meta_clear_failed', collection });
        log.debug('Snapshot meta clear error detail', { reason: errorReason(error) });
      }
    }
    log.debug('Cleared snapshot for one origin');
  }
}

/** The shared org snapshot store. */
export const orgSnapshotStore = new OrgSnapshotStore();
