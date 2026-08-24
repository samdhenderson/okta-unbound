/**
 * @module shared/snapshot/syncMeta
 * @description Pure decisions over {@link SyncMeta} — the parts of ADR-0040's
 * freshness contract that involve no IndexedDB and no network.
 *
 * They live apart from `orgSnapshotStore` so the rules that decide *whether a
 * snapshot may be trusted* are unit-testable without a database, and so the sync
 * engine and the panel read path apply the identical rule rather than each
 * re-deriving it.
 */

import type { DriftVerdict, SnapshotCollection, SyncMeta } from './types';

/**
 * How long a snapshot may be served before a drift check is owed.
 *
 * ADR-0040's invariant is that a snapshot is only as trustworthy as its last
 * drift check — a delta cannot see a deletion. Fifteen minutes bounds the window
 * in which a deleted group can still be listed, at a cost of one request.
 */
export const DRIFT_CHECK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * A fresh, never-synced {@link SyncMeta} for a collection.
 *
 * Every unknown is `null` rather than a zero or a `false`: "never probed" and
 * "probed and unsupported" are different facts, and so are "no rows reported" and
 * "Okta has not told us".
 *
 * @param origin - The org origin this record is scoped to.
 * @param collection - The collection it describes.
 * @returns An empty meta record.
 */
export function emptySyncMeta(origin: string, collection: SnapshotCollection): SyncMeta {
  return {
    origin,
    collection,
    lastFullWalkAt: null,
    lastDeltaAt: null,
    watermark: null,
    itemCount: null,
    cursor: null,
    walkStartedAt: null,
    deltaSupported: null,
    complete: false,
  };
}

/**
 * Advance a watermark past every candidate `lastUpdated` seen on a page.
 *
 * Okta returns `lastUpdated` as an ISO 8601 UTC string with fixed precision
 * (`2026-08-24T09:15:00.000Z`), so lexicographic ordering **is** chronological
 * ordering and no `Date` parse is needed. Values that do not look like that are
 * ignored rather than compared, since a malformed row must not be able to shove
 * the watermark into the future and make every later delta skip real changes.
 *
 * @param current - The watermark so far, or `null` when none has been recorded.
 * @param candidates - `lastUpdated` values from the rows just stored.
 * @returns The highest value, or `current` when no candidate beats it.
 */
export function advanceWatermark(
  current: string | null,
  candidates: ReadonlyArray<string | undefined | null>,
): string | null {
  let best = current;
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !ISO_UTC.test(candidate)) continue;
    if (best === null || candidate > best) best = candidate;
  }
  return best;
}

/** ISO 8601 UTC instant, the shape Okta returns timestamps in. */
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

/**
 * Compare what Okta says the collection holds against what the snapshot holds.
 *
 * @param reportedTotal - `x-total-count` from a `limit=1` probe, or `null` when
 * the header was absent or unparseable.
 * @param storedCount - How many rows the snapshot holds for this collection.
 * @returns `unknown` when Okta did not say, otherwise whether the two agree.
 * @remarks An absent header is **not** agreement (ADR-0040 §7). Reporting
 * `in-sync` for it would let a diverged snapshot escape a full walk indefinitely,
 * which is precisely the failure the drift check exists to catch.
 */
export function driftVerdict(reportedTotal: number | null, storedCount: number): DriftVerdict {
  if (reportedTotal === null || !Number.isFinite(reportedTotal) || reportedTotal < 0) {
    return 'unknown';
  }
  return reportedTotal === storedCount ? 'in-sync' : 'drifted';
}

/**
 * Read `x-total-count` off a response header bag.
 *
 * @param headers - Response headers; keys are matched case-insensitively, since
 * header casing is not guaranteed across the messaging hops.
 * @returns The count, or `null` when the header is absent or not a whole number.
 */
export function readTotalCount(headers: Record<string, string> | undefined): number | null {
  if (!headers) return null;
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== 'x-total-count') continue;
    // `Number('')` and `Number('   ')` are both 0, so an empty header would
    // otherwise read as Okta positively reporting an empty collection — which is
    // the exact "absence is not zero" confusion this function exists to prevent.
    if (typeof value !== 'string' || value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

/** Which sync mode a collection is due for. */
export type SyncMode = 'full' | 'delta' | 'drift-check' | 'none';

/**
 * Decide the cheapest sync that keeps ADR-0040's invariant.
 *
 * The ladder, in order:
 * 1. **Full** — nothing stored, the last walk never finished, or a walk was
 *    interrupted mid-cursor. Also the only refresh available to a collection
 *    with no cheap mode, once its interval has elapsed.
 * 2. **Drift check** — the snapshot is complete but its last check has aged past
 *    `refreshIntervalMs`. One request; it may then escalate to full.
 * 3. **Delta** — complete, recently checked, and there is a watermark to query
 *    from.
 * 4. **None** — complete and recently checked, with no watermark to advance from
 *    (an empty collection) or no cheap mode to advance it with.
 *
 * **The interval gates every collection, including the ones with no cheap mode.**
 * `deltaSupported: false` used to short-circuit straight to `'full'`, which meant
 * an org failing the delta probe — and any collection that can never support one,
 * like a sharded fan-out — re-walked itself in full on *every* sync attempt: each
 * Okta tab load and each alarm tick. Correct, but it spent an org's rate limit
 * re-deriving an answer minutes old, which is the cost this module exists to
 * avoid.
 *
 * @param meta - The collection's current bookkeeping.
 * @param now - Epoch millis, injected so the decision stays pure.
 * @param refreshIntervalMs - How long this collection may be served before a
 * check is owed. Defaults to {@link DRIFT_CHECK_INTERVAL_MS}; a collection whose
 * shape makes walking expensive passes a longer one.
 * @returns The mode to run.
 */
export function nextSyncMode(
  meta: SyncMeta,
  now: number,
  refreshIntervalMs: number = DRIFT_CHECK_INTERVAL_MS,
): SyncMode {
  // A walk that never completed, or one suspended mid-cursor, is not a snapshot
  // yet — it must not be topped up by a delta, which would leave the untouched
  // pages missing forever while every later check reported agreement.
  if (!meta.complete || meta.cursor !== null || meta.lastFullWalkAt === null) return 'full';

  // A collection with no cheap mode never records a delta, so this is its last
  // full walk.
  const lastChecked = meta.lastDeltaAt ?? meta.lastFullWalkAt;
  const due = now - lastChecked >= refreshIntervalMs;

  // Probed and unsupported: no drift check to run and no delta to send, so the
  // only way to notice a change is to walk it again — on the interval, not on
  // every attempt.
  if (meta.deltaSupported === false) return due ? 'full' : 'none';

  if (due) return 'drift-check';

  return meta.watermark === null ? 'none' : 'delta';
}
