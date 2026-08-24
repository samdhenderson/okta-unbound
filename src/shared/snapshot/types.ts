/**
 * @module shared/snapshot/types
 * @description Shapes for the background-owned org snapshot (ADR-0040).
 *
 * Kept separate from the store so the sync engine, the panel read path and the
 * store's own tests can share one vocabulary without importing IndexedDB code.
 */

/**
 * The collections the snapshot holds.
 *
 * Deliberately does **not** include group membership: it is the largest and most
 * personal collection in an org, and the questions ADR-0040 exists to answer are
 * served by counts (`expand=stats`) rather than by member lists. Adding it is a
 * separate decision with its own retention argument.
 */
export type SnapshotCollection = 'groups' | 'apps' | 'rules' | 'appGroups';

/** Every collection name, for iteration (e.g. clearing an origin). */
export const SNAPSHOT_COLLECTIONS: readonly SnapshotCollection[] = [
  'groups',
  'apps',
  'rules',
  'appGroups',
] as const;

/**
 * One stored entity.
 *
 * The Okta entity is nested under `entity` rather than spread across the record so
 * that a field named `id` or `origin` in a future Okta payload can never collide
 * with the compound key. `entity` holds the **zod-parsed** row (ADR-0006), never a
 * raw response body.
 */
export interface SnapshotRecord<T = unknown> {
  /** Org origin this row belongs to, e.g. `https://example.okta.com`. */
  origin: string;
  /** Okta entity id; unique within the origin, and globally in practice. */
  id: string;
  /** The validated entity. */
  entity: T;
  /** Epoch millis this row was last written by a sync. */
  syncedAt: number;
}

/**
 * Per-`(origin, collection)` sync bookkeeping — the record that decides which of
 * ADR-0040's three sync modes may run next.
 */
export interface SyncMeta {
  /** Org origin. */
  origin: string;
  /** Which collection this describes. */
  collection: SnapshotCollection;
  /**
   * Epoch millis the last **complete** full walk finished, or `null` if none ever
   * has. A walk that was interrupted does not set this — see {@link complete}.
   */
  lastFullWalkAt: number | null;
  /** Epoch millis of the last delta sync, or `null`. */
  lastDeltaAt: number | null;
  /**
   * The highest `lastUpdated` observed across stored rows, as the ISO string Okta
   * returned it. This is the operand of the delta's `search=lastUpdated gt "…"`.
   *
   * Held as a string, not a `Date`: it is re-sent to Okta verbatim, and a
   * round-trip through `Date` risks changing the precision Okta echoed.
   */
  watermark: string | null;
  /**
   * The row count Okta last reported via `x-total-count`, or `null` when it has
   * never been observed. `null` is **unknown**, never zero (ADR-0040 §7).
   */
  itemCount: number | null;
  /**
   * Resume point for an interrupted walk (the next page URL), or `null` when no
   * walk is in progress. Persisted because an MV3 worker can suspend mid-walk.
   */
  cursor: string | null;
  /**
   * Epoch millis the in-progress full walk began, or `null` when none is.
   *
   * This is the **mark** half of the walk's mark-and-sweep reconciliation: every
   * row a walk writes is stamped with this value, and on completion every row
   * older than it is swept, because a full walk returns every row the org still
   * has. A resumed walk reuses the same value, which is what makes resuming
   * correct without having to remember which ids earlier pages returned.
   */
  walkStartedAt: number | null;
  /**
   * Whether this org honours `search=lastUpdated gt`. `null` means not yet
   * probed; `false` means the org full-walks from here on (ADR-0040 §4).
   */
  deltaSupported: boolean | null;
  /**
   * Whether the last walk finished. A partial snapshot must never be served as
   * the whole org (ADR-0040 §7), so readers check this rather than assuming.
   */
  complete: boolean;
  /**
   * For a **sharded** collection, the shard keys already walked under the
   * current {@link walkStartedAt} mark.
   *
   * A sharded walk is N independent walks — one per app, for `appGroups` — so
   * `cursor` cannot express its progress: there is no single next-page URL. This
   * is the resume unit instead. An interruption costs at most the shards in
   * flight rather than all N, and a resumed walk re-uses the same mark so its
   * sweep still covers what the earlier shards wrote.
   *
   * Empty for every single-URL collection, which resume by `cursor`.
   */
  completedShards: string[];
}

/**
 * The verdict of a drift check.
 *
 * `unknown` exists because a missing `x-total-count` is an absence of evidence,
 * not evidence of agreement — collapsing it into `in-sync` would let a snapshot
 * that has silently diverged go unchecked forever.
 */
export type DriftVerdict = 'in-sync' | 'drifted' | 'unknown';
