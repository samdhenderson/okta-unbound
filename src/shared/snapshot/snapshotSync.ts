/**
 * @module shared/snapshot/snapshotSync
 * @description The full-walk sync that fills the org snapshot (ADR-0040).
 *
 * Walks an Okta collection page by page, writing each page into
 * {@link orgSnapshotStore} as it lands rather than at the end — so the snapshot
 * is durable against an MV3 worker suspension mid-walk, and the panel can paint
 * per page instead of after the last one.
 *
 * Two things it deliberately does not do. It does **not** own a transport: the
 * page request is injected, so the background wires it to the `ApiScheduler` and
 * a test wires it to canned pages, and this module never touches `chrome.*`. And
 * it does **not** conclude a deletion from anything but a walk it watched
 * complete — see {@link runFullWalk}'s sweep.
 *
 * Each {@link CollectionSpec} also carries a `parseVersion` recording what its
 * walk asks Okta for and what it does with the answer (ADR-0066). A spec whose
 * version has moved past the one stored for an org re-walks that collection once
 * — the only repair available, since a mapper cannot recover bytes that were
 * never fetched.
 *
 * @see {@link module:shared/snapshot/syncMeta} for the freshness decisions.
 * @see {@link module:shared/snapshot/parseVersion} for the version comparison.
 * @see {@link module:shared/utils/oktaPagination} for the walk itself.
 */

import type { z } from 'zod';
import {
  isGroupPushApp,
  oktaAppGroupAssignmentSchema,
  oktaAppListItemSchema,
  oktaGroupListItemSchema,
  oktaGroupRuleSchema,
  type OktaAppListItem,
} from '../schemas/okta';
import {
  fetchAllPages,
  OKTA_PAGE_SIZE,
  PaginatedFetchError,
  type PaginatedPageResult,
} from '../utils/oktaPagination';
import { createLogger } from '../utils/logger';
import { orgSnapshotStore } from './orgSnapshotStore';
import { isParseVersionStale } from './parseVersion';
import {
  advanceWatermark,
  driftVerdict,
  nextSyncMode,
  readTotalCount,
  type SyncMode,
} from './syncMeta';
import { SHARD_KEY_SEPARATOR, type SnapshotCollection, type SyncMeta } from './types';

const log = createLogger('SnapshotSync');

/**
 * Issues one page request. Injected so this module stays free of Chrome-runtime
 * plumbing; the background supplies a scheduler-routed implementation at `low`
 * priority, and tests supply canned pages.
 *
 * @param reason - Human-readable "why", recorded to the verbose request audit
 * log. One `PageRequest` instance is shared across every collection in a walk
 * (`syncOrg` runs them concurrently), so the reason travels per-call rather
 * than being fixed at construction time — this module passes `spec.context`.
 */
export type PageRequest = (url: string, reason?: string) => Promise<PaginatedPageResult>;

/**
 * One leg of a **sharded** collection: a walk that is only part of the answer.
 *
 * Most collections are a single paginated listing. Some are a fan-out — the
 * org's app-group assignments live at `/api/v1/apps/{id}/groups`, one listing
 * per app, with no endpoint that returns them together. A shard is one of those
 * listings plus the key that says which one it was.
 */
export interface Shard {
  /**
   * Stable identifier for this leg (an app id). Used as the resume unit and, by
   * convention, as the prefix that keeps rows from different shards from
   * colliding — see {@link CollectionSpec.identify}.
   */
  key: string;
  /** First-page URL for this shard's walk. */
  firstUrl: string;
}

/**
 * Produce the shards to walk for an org.
 *
 * Runs against the snapshot rather than the network wherever it can: the shard
 * list for `appGroups` is derived from the already-stored app inventory, so
 * discovering *what to walk* costs no request at all.
 */
export type ShardProvider = (origin: string) => Promise<Shard[]>;

/** What a collection needs in order to be walked. */
export interface CollectionSpec<T = unknown> {
  /** Which snapshot collection the rows land in. */
  collection: SnapshotCollection;
  /**
   * Canonical first-page URL, including `limit` and any `expand`.
   *
   * For a sharded collection this is the shape shards follow rather than a URL
   * that is ever fetched; {@link countUrl} still derives the collection's path
   * from it.
   */
  firstUrl: string;
  /** Per-row boundary schema; malformed rows drop leniently (ADR-0006). */
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  /**
   * What this build's walk asks Okta for and stores (ADR-0066).
   *
   * Persisted per `(origin, collection)` in {@link SyncMeta.parseVersion} when a
   * walk completes; a mismatch makes the next sync attempt a full walk, once.
   *
   * **Bump it when the request or the write-time transform changes** — a new
   * `expand=`, a different {@link shards} selection or shard-key grammar, a
   * change to {@link identify}, a move to another endpoint, or a schema that
   * starts narrowing rather than passing through. None of those can be repaired
   * later, because the bytes are not in the store.
   *
   * **Do not bump it for a read-side change.** The list schemas are
   * `.passthrough()` and the store persists the parsed row, so a mapper that
   * learns to read a field Okta was already sending lights up existing rows for
   * free; a bump there would re-walk the org to buy nothing. The mechanical
   * question is *is the value already in the stored row?*
   *
   * Required rather than optional so a new collection cannot be added without
   * answering the question — and `parseVersion.test.ts` fingerprints every spec
   * so a wire change that forgets its bump fails there rather than silently
   * stranding every already-synced org.
   */
  parseVersion: number;
  /** Query parameters Okta may drop from its `rel="next"` link. */
  preserveParams?: string[];
  /** Label used in validation and log messages. */
  context: string;
  /**
   * Present only on a **sharded** collection: what to walk, one leg at a time.
   * Its presence is what routes {@link syncCollection} to the fan-out walk.
   */
  shards?: ShardProvider;
  /**
   * Override how a row's storage key is derived, for collections where Okta's
   * `id` is not unique within the collection.
   *
   * The default reads `row.id`, which is right for groups, apps and rules. It is
   * **wrong** for app-group assignments: Okta returns the assigned *group's* id
   * there, so one group assigned to two apps would collide on a single
   * `[origin, id]` key and the second app would silently overwrite the first.
   * Such a spec composes the shard key into the id instead.
   */
  identify?: (row: unknown, shard: Shard | null) => { id: string; lastUpdated?: string } | null;
  /**
   * How long this collection may be served before a check is owed. Defaults to
   * `DRIFT_CHECK_INTERVAL_MS`. A collection whose walk is expensive — a fan-out
   * costs one walk per shard — is given a longer leash.
   */
  refreshIntervalMs?: number;
}

/**
 * How many shards are walked at once.
 *
 * Matched to the scheduler's own `maxConcurrent` so the fan-out keeps its slots
 * busy without queueing a hundred `low`-priority requests behind a user who is
 * about to click something. Progress is recorded per completed batch, so an
 * interruption costs at most this many shards.
 */
const SHARD_CONCURRENCY = 5;

/** Outcome of one collection walk. */
export interface WalkOutcome {
  /** Which collection was walked. */
  collection: SnapshotCollection;
  /** Whether the walk reached the last page. */
  complete: boolean;
  /** Rows written across every page. */
  written: number;
  /** Rows swept as no longer present in Okta; `0` for an incomplete walk. */
  swept: number;
  /** Failure message when `complete` is `false` and the walk threw. */
  error?: string;
  /**
   * The failing page's HTTP status, when the walk stopped on a
   * {@link PaginatedFetchError} — a real status (401, 403, 429…) or
   * `undefined` when the transport never produced one (a dropped connection,
   * a rejected schedule). Lets a reader (`orgFigures.ts`) tell "you are not
   * allowed to read this" apart from "this failed for some other reason"
   * instead of every stopped walk reading identically (D-068). Absent for a
   * walk that never failed, and — for {@link runShardedWalk} — absent even on
   * failure, since a fan-out's shards can fail with different statuses and
   * there is no single one to report.
   */
  status?: number;
  /** Which mode actually ran, after any escalation. */
  mode?: SyncMode;
}

/**
 * A row's identity and freshness, read defensively off a validated row.
 *
 * The schemas are `.passthrough()`, so `id` and `lastUpdated` are present at
 * runtime but not in the narrow inferred types. Reading them here — rather than
 * asking each spec for an accessor — keeps every collection on one rule.
 *
 * @param row - A validated Okta row.
 * @returns The row's id, and its `lastUpdated` when it carries a string one.
 */
function identify(row: unknown): { id: string; lastUpdated?: string } | null {
  if (typeof row !== 'object' || row === null) return null;
  const record = row as { id?: unknown; lastUpdated?: unknown };
  if (typeof record.id !== 'string' || record.id === '') return null;
  return {
    id: record.id,
    lastUpdated: typeof record.lastUpdated === 'string' ? record.lastUpdated : undefined,
  };
}

/** Called after each page lands, so a reader can repaint mid-walk. */
export type PageSink = (collection: SnapshotCollection, totalSoFar: number) => void;

/** Inputs to {@link runFullWalk}. */
export interface FullWalkOptions {
  /** Org origin the rows are scoped to. */
  origin: string;
  /** Page transport. */
  request: PageRequest;
  /** Epoch millis, injected so the walk's mark and timestamps stay testable. */
  now: number;
  /** Notified after each page with the running row count. */
  onPage?: PageSink;
  /**
   * Skip the cheap modes and walk in full.
   *
   * What the Refresh button means. Without it a manual refresh moments after a
   * load would resolve to `none` and appear to do nothing, and — more
   * importantly — an admin who suspects the snapshot is wrong has no way to say
   * so. A person asking for the expensive answer gets the expensive answer.
   */
  force?: boolean;
}

/**
 * Walk one collection in full and reconcile the snapshot against it.
 *
 * Each page is validated, written with the walk's mark as its `syncedAt`, and
 * announced through `onPage`. The walk's resume cursor and watermark are
 * persisted per page, so an interruption loses at most the page in flight.
 *
 * **A deletion is only ever concluded from a walk that completed.** On success
 * the sweep drops every row older than the walk's mark, because a full walk
 * returns everything the org still has. On failure nothing is swept and
 * `complete` stays `false`, so the collection is not served as the whole org and
 * {@link nextSyncMode} will full-walk it again — a partial answer rendered as a
 * complete one is the failure this ordering exists to prevent.
 *
 * @param spec - The collection to walk.
 * @param options - See {@link FullWalkOptions}.
 * @returns What the walk wrote, swept, and whether it finished. Never throws.
 */
export async function runFullWalk<T>(
  spec: CollectionSpec<T>,
  options: FullWalkOptions,
): Promise<WalkOutcome> {
  const { origin, request, now, onPage } = options;
  const { collection } = spec;

  // A resumed walk reuses the original mark, so the sweep still covers rows the
  // interrupted pages had returned. A fresh walk stamps a new one.
  const previous = await orgSnapshotStore.getMeta(collection, origin);
  const resuming = previous.cursor !== null && previous.walkStartedAt !== null;
  const mark = resuming ? (previous.walkStartedAt as number) : now;
  const startUrl = resuming ? (previous.cursor as string) : spec.firstUrl;

  await orgSnapshotStore.patchMeta(collection, origin, {
    walkStartedAt: mark,
    cursor: startUrl,
    complete: false,
  });

  let watermark = previous.watermark;
  let written = 0;

  // `fetchAllPages` does not await its page callbacks — it cannot, without
  // changing timing for every existing caller — so the store writes are chained
  // here instead. Serialising them matters twice over: two `patchMeta` calls in
  // flight are a read-modify-write race that can lose the cursor, and an unawaited
  // final page would let the sweep below delete rows that were still being
  // written. `drained` is awaited before anything reads the store back.
  let drained: Promise<void> = Promise.resolve();
  const enqueue = (work: () => Promise<unknown>): void => {
    drained = drained.then(() => work()).then(() => undefined);
  };

  try {
    await fetchAllPages<T>(
      (pageUrl) => request(pageUrl, `Org inventory sync: ${spec.context}`),
      startUrl,
      {
        schema: spec.schema,
        context: spec.context,
        preserveParams: spec.preserveParams,
        // On a resume the walk starts at a cursor, so the parameters to re-apply
        // must come from the canonical URL rather than from the cursor.
        paramSource: spec.firstUrl,
        onPage: (rows, totalSoFar) => {
          const identified: Array<{ id: string; entity: T; lastUpdated?: string }> = [];
          for (const row of rows) {
            const meta = identify(row);
            // A row with no usable id cannot be keyed, so it is dropped rather
            // than stored under a synthesised key that no later walk would match.
            if (meta) identified.push({ id: meta.id, entity: row, lastUpdated: meta.lastUpdated });
          }

          watermark = advanceWatermark(
            watermark,
            identified.map((item) => item.lastUpdated),
          );
          written = totalSoFar;

          enqueue(() => orgSnapshotStore.upsertMany(collection, origin, identified, mark));
          onPage?.(collection, totalSoFar);
        },
        onCursor: (nextUrl) => {
          const at = watermark;
          enqueue(() =>
            orgSnapshotStore.patchMeta(collection, origin, { cursor: nextUrl, watermark: at }),
          );
        },
      },
    );
    await drained;
  } catch (error) {
    // Let the queued writes finish before reporting: the pages that did land are
    // real rows, and abandoning their writes would leave the resume cursor
    // pointing past data that was never stored.
    await drained.catch(() => undefined);
    // Identifiers and outcomes only — never a response body or an entity name.
    const message = error instanceof Error ? error.message : 'Walk failed';
    const status = error instanceof PaginatedFetchError ? error.status : undefined;
    log.error('Full walk did not complete', { code: 'snapshot_walk_failed', collection, status });
    // The cursor and `complete: false` are left exactly as the last page set
    // them, which is what lets the next attempt resume rather than restart.
    await orgSnapshotStore.patchMeta(collection, origin, { watermark });
    return { collection, complete: false, written, swept: 0, error: message, status };
  }

  const swept = await orgSnapshotStore.sweepStale(collection, origin, mark);
  const itemCount = await orgSnapshotStore.countCollection(collection, origin);

  await orgSnapshotStore.patchMeta(collection, origin, {
    complete: true,
    lastFullWalkAt: now,
    cursor: null,
    walkStartedAt: null,
    watermark,
    itemCount,
    // Stamped here and nowhere else: only a walk that reached the last page has
    // rewritten every row under the current question. The failure return above
    // deliberately leaves the stored version alone, because half a collection at
    // the new version is the state ADR-0066 exists to make impossible.
    parseVersion: spec.parseVersion,
  });

  log.debug('Full walk complete', { collection, written, swept, itemCount });
  return { collection, complete: true, written, swept };
}

/**
 * A watermark no real row can be newer than.
 *
 * The delta-support probe turns on this: `search=lastUpdated gt "<far future>"`
 * must match nothing. An org that honours the filter answers `x-total-count: 0`;
 * an org that silently ignores it answers with the collection's full size, and
 * the two are impossible to confuse. The `.claude/skills/okta-api` reference
 * warns that an unsupported `search` field may be **ignored with a 200** rather
 * than rejected, which is exactly the failure that would otherwise make a delta
 * look cheap while quietly skipping every real change.
 */
const UNREACHABLE_WATERMARK = '9999-01-01T00:00:00.000Z';

/**
 * Build a counting URL for a collection: one row, so the answer is the header.
 *
 * Deliberately built from the spec's **path**, dropping its `expand`s and page
 * size — a probe wants the `x-total-count` header, and paying for embedded
 * member counts on a row nobody reads is waste.
 *
 * @param spec - The collection.
 * @param search - Optional `search` expression to count under.
 * @returns A relative Okta path with `limit=1`.
 */
function countUrl(spec: CollectionSpec, search?: string): string {
  const path = spec.firstUrl.split('?')[0];
  const params = new URLSearchParams({ limit: '1' });
  if (search) params.set('search', search);
  return `${path}?${params.toString()}`;
}

/**
 * Build the delta URL: the canonical first page, filtered to what changed.
 *
 * @param spec - The collection.
 * @param watermark - Highest `lastUpdated` the snapshot has seen.
 * @returns The spec's `firstUrl` with a `search` filter appended.
 */
function deltaUrl(spec: CollectionSpec, watermark: string): string {
  const separator = spec.firstUrl.includes('?') ? '&' : '?';
  const search = encodeURIComponent(`lastUpdated gt "${watermark}"`);
  return `${spec.firstUrl}${separator}search=${search}`;
}

/**
 * Ask whether this org honours `search=lastUpdated gt …` on this collection.
 *
 * @param spec - The collection to probe.
 * @param request - Page transport.
 * @returns `true` only when the org demonstrably filtered.
 * @remarks Every uncertain answer is `false`. A failed request, an absent
 * `x-total-count`, and a non-zero count all mean the same thing here — the
 * filter was not *proven* to work — and trusting an unproven filter would let
 * every later sync skip real changes while reporting success. Being wrong in
 * this direction costs a full walk; being wrong in the other costs correctness.
 */
async function probeDeltaSupport(spec: CollectionSpec, request: PageRequest): Promise<boolean> {
  const result = await request(
    countUrl(spec, `lastUpdated gt "${UNREACHABLE_WATERMARK}"`),
    `Org inventory sync: ${spec.context} (delta probe)`,
  );
  if (!result.success) return false;
  return readTotalCount(result.headers) === 0;
}

/**
 * Compare Okta's row count against the snapshot's, in one request.
 *
 * This is the half of ADR-0040's freshness argument that a delta cannot supply:
 * **nothing is updated when a row is deleted**, so `lastUpdated` can never
 * observe a deletion, and only a count comparison can.
 *
 * @param spec - The collection to check.
 * @param options - See {@link FullWalkOptions}.
 * @returns Whether the two agree — `unknown` when Okta did not say.
 */
async function runDriftCheck(
  spec: CollectionSpec,
  options: FullWalkOptions,
): Promise<ReturnType<typeof driftVerdict>> {
  const { origin, request } = options;
  const result = await request(countUrl(spec), `Org inventory sync: ${spec.context} (drift check)`);
  if (!result.success) return 'unknown';
  const stored = await orgSnapshotStore.countCollection(spec.collection, origin);
  return driftVerdict(readTotalCount(result.headers), stored);
}

/**
 * Fetch and store only what changed since the watermark.
 *
 * Usually zero or one request. **Nothing is swept**: a filtered listing is not
 * evidence about the rows it excluded, so concluding a deletion from it would
 * delete every row that simply had not changed. Deletions are the drift check's
 * job, and only a completed full walk ever sweeps.
 *
 * @param spec - The collection.
 * @param options - See {@link FullWalkOptions}.
 * @param meta - The collection's bookkeeping as read by {@link syncCollection}.
 * @returns What the delta wrote. Escalates to a full walk if the org turns out
 * not to honour the filter.
 */
async function runDelta<T>(
  spec: CollectionSpec<T>,
  options: FullWalkOptions,
  meta: SyncMeta,
): Promise<WalkOutcome> {
  const { origin, request, now, onPage } = options;
  const { collection } = spec;

  if (meta.deltaSupported === null) {
    const supported = await probeDeltaSupport(spec, request);
    await orgSnapshotStore.patchMeta(collection, origin, { deltaSupported: supported });
    if (!supported) {
      log.debug('Delta filter not honoured; falling back to a full walk', { collection });
      return { ...(await runFullWalk(spec, options)), mode: 'full' };
    }
  }

  // Nothing to measure changes from. Not an error — an org whose collection is
  // empty has no watermark, and there is genuinely nothing to ask for.
  if (meta.watermark === null) {
    await orgSnapshotStore.patchMeta(collection, origin, { lastDeltaAt: now });
    return { collection, complete: true, written: 0, swept: 0, mode: 'none' };
  }

  let watermark = meta.watermark;
  let written = 0;
  let drained: Promise<void> = Promise.resolve();
  const enqueue = (work: () => Promise<unknown>): void => {
    drained = drained.then(() => work()).then(() => undefined);
  };

  try {
    await fetchAllPages<T>(
      (pageUrl) => request(pageUrl, `Org inventory sync: ${spec.context} (delta)`),
      deltaUrl(spec, watermark),
      {
        schema: spec.schema,
        context: `${spec.context} (delta)`,
        preserveParams: spec.preserveParams ? [...spec.preserveParams, 'search'] : ['search'],
        onPage: (rows, totalSoFar) => {
          const identified: Array<{ id: string; entity: T; lastUpdated?: string }> = [];
          for (const row of rows) {
            const item = identify(row);
            if (item) identified.push({ id: item.id, entity: row, lastUpdated: item.lastUpdated });
          }
          watermark = advanceWatermark(
            watermark,
            identified.map((item) => item.lastUpdated),
          ) as string;
          written = totalSoFar;
          enqueue(() => orgSnapshotStore.upsertMany(collection, origin, identified, now));
          onPage?.(collection, totalSoFar);
        },
      },
    );
    await drained;
  } catch (error) {
    await drained.catch(() => undefined);
    const message = error instanceof Error ? error.message : 'Delta failed';
    const status = error instanceof PaginatedFetchError ? error.status : undefined;
    // Identifiers and outcomes only — never a response body or an entity name.
    log.error('Delta sync did not complete', {
      code: 'snapshot_delta_failed',
      collection,
      status,
    });
    // `complete` is deliberately left alone: the snapshot is still whole as of
    // its last full walk, it is merely no fresher than it already was. Leaving
    // `lastDeltaAt` unmoved is what makes the next attempt retry.
    return {
      collection,
      complete: meta.complete,
      written,
      swept: 0,
      error: message,
      status,
      mode: 'delta',
    };
  }

  const itemCount = await orgSnapshotStore.countCollection(collection, origin);
  await orgSnapshotStore.patchMeta(collection, origin, { watermark, lastDeltaAt: now, itemCount });
  log.debug('Delta sync complete', { collection, written, itemCount });
  return { collection, complete: true, written, swept: 0, mode: 'delta' };
}

/**
 * Walk a **sharded** collection: N independent listings that together are the
 * collection.
 *
 * The shape `runFullWalk` cannot express. `/api/v1/apps/{id}/groups` is one
 * listing per app and Okta offers nothing that returns them together, so the
 * collection is assembled from a fan-out. Three things follow, and each is the
 * sharded analogue of a rule {@link runFullWalk} already keeps:
 *
 * - **The mark is shared across every shard.** All shards stamp the same
 *   `walkStartedAt`, so one sweep at the end reconciles the whole collection —
 *   including an app that has disappeared from the org entirely, whose rows
 *   simply never get re-marked.
 * - **The sweep runs only if every shard finished.** A fan-out that lost a leg
 *   is missing rows, not looking at deletions; sweeping on it would delete a
 *   live app's assignments because one request failed. Same reason a partial
 *   page walk never sweeps.
 * - **Progress is recorded per batch, in `completedShards`.** `cursor` cannot
 *   describe "23 of 40 apps done", so the resume unit is the shard. A resumed
 *   walk re-uses the original mark and skips what is already recorded.
 *
 * A sharded collection has no cheap mode — there is no org-wide count to compare
 * and no listing to filter by `lastUpdated` — so `deltaSupported` is written
 * `false` here rather than probed. Its refresh cadence is
 * {@link CollectionSpec.refreshIntervalMs}.
 *
 * @param spec - The collection; must carry {@link CollectionSpec.shards}.
 * @param options - See {@link FullWalkOptions}.
 * @returns What the fan-out wrote, swept, and whether every shard finished.
 * Never throws.
 */
export async function runShardedWalk<T>(
  spec: CollectionSpec<T>,
  options: FullWalkOptions,
): Promise<WalkOutcome> {
  const { origin, request, now, onPage } = options;
  const { collection } = spec;
  const shardsOf = spec.shards;
  // Not reachable through `syncCollection`, which routes on this field; guarded
  // so a direct caller degrades to the single-URL walk rather than crashing.
  if (!shardsOf) return runFullWalk(spec, options);

  const identifyRow = spec.identify ?? ((row: unknown) => identify(row));

  const previous = await orgSnapshotStore.getMeta(collection, origin);
  // A sharded walk resumes on `walkStartedAt` alone: it may well have been
  // suspended *between* shards, when there is no cursor to have left behind.
  const resuming = previous.walkStartedAt !== null && !previous.complete;
  const mark = resuming ? (previous.walkStartedAt as number) : now;
  const done = new Set<string>(resuming ? previous.completedShards : []);

  let shards: Shard[];
  try {
    shards = await shardsOf(origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Shard discovery failed';
    // Identifiers and outcomes only — never a response body or an entity name.
    log.error('Sharded walk could not determine its shards', {
      code: 'snapshot_shards_failed',
      collection,
    });
    return { collection, complete: false, written: 0, swept: 0, error: message };
  }

  await orgSnapshotStore.patchMeta(collection, origin, {
    walkStartedAt: mark,
    complete: false,
    deltaSupported: false,
    completedShards: [...done],
    // A fan-out's progress lives in `completedShards`; a stale cursor from some
    // earlier single-URL walk of this collection must not be resumed into.
    cursor: null,
  });

  const pending = shards.filter((shard) => !done.has(shard.key));
  let written = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i += SHARD_CONCURRENCY) {
    const batch = pending.slice(i, i + SHARD_CONCURRENCY);
    const settled = await Promise.all(
      batch.map(async (shard) => {
        const rows: Array<{ id: string; entity: T; lastUpdated?: string }> = [];
        try {
          await fetchAllPages<T>(
            (pageUrl) => request(pageUrl, `Org inventory sync: ${spec.context} (${shard.key})`),
            shard.firstUrl,
            {
              schema: spec.schema,
              context: `${spec.context} (${shard.key})`,
              preserveParams: spec.preserveParams,
              paramSource: shard.firstUrl,
              onPage: (page) => {
                for (const row of page) {
                  const item = identifyRow(row, shard);
                  // A row with no usable id cannot be keyed, so it is dropped
                  // rather than stored under a synthesised key no later walk
                  // would match.
                  if (item) rows.push({ id: item.id, entity: row, lastUpdated: item.lastUpdated });
                }
              },
            },
          );
        } catch {
          // One app's listing failing is not the collection failing. The shard
          // is left out of `completedShards`, which both keeps its existing rows
          // safe from the sweep below and has the next walk retry it. Logged at
          // batch level rather than per shard so a broadly failing org does not
          // write one line per app.
          return { shard, rows, ok: false };
        }
        return { shard, rows, ok: true };
      }),
    );

    // Written after the batch settles rather than inside `onPage`: a shard that
    // throws mid-walk must not leave a partial listing marked as this walk's,
    // because `completedShards` would then be the only thing standing between
    // those rows and a sweep that believes them current.
    for (const result of settled) {
      if (!result.ok) {
        failed += 1;
        continue;
      }
      if (result.rows.length > 0) {
        await orgSnapshotStore.upsertMany(collection, origin, result.rows, mark);
      }
      written += result.rows.length;
      done.add(result.shard.key);
    }

    await orgSnapshotStore.patchMeta(collection, origin, { completedShards: [...done] });
    onPage?.(collection, written);
  }

  if (failed > 0) {
    log.warn('Sharded walk did not reach every shard', {
      code: 'snapshot_shards_incomplete',
      collection,
      failed,
      total: shards.length,
    });
    // No sweep, and `complete` stays false: the next attempt full-walks and
    // retries only the shards still missing from `completedShards`.
    return {
      collection,
      complete: false,
      written,
      swept: 0,
      error: `${failed} of ${shards.length} listings failed`,
    };
  }

  const swept = await orgSnapshotStore.sweepStale(collection, origin, mark);
  const itemCount = await orgSnapshotStore.countCollection(collection, origin);

  await orgSnapshotStore.patchMeta(collection, origin, {
    complete: true,
    lastFullWalkAt: now,
    cursor: null,
    walkStartedAt: null,
    completedShards: [],
    itemCount,
    // Only after every shard finished. A fan-out that lost a leg has not
    // re-walked the whole collection, so it has not earned the new version any
    // more than it has earned the sweep above (ADR-0066 §3).
    parseVersion: spec.parseVersion,
  });

  log.debug('Sharded walk complete', { collection, shards: shards.length, written, swept });
  return { collection, complete: true, written, swept };
}

/**
 * Sync one collection by the cheapest mode that keeps the snapshot honest.
 *
 * The ladder is {@link nextSyncMode}'s, with two escalations this function owns:
 * a drift check that does **not** come back `in-sync` becomes a full walk — both
 * `drifted` and `unknown` escalate, because an org that did not answer the
 * question has not answered it in the affirmative (ADR-0040 §7) — and a
 * collection whose stored `parseVersion` is behind its spec's skips the ladder
 * entirely and walks in full, once (ADR-0066).
 *
 * @param spec - The collection.
 * @param options - See {@link FullWalkOptions}; `force` skips straight to full.
 * @returns The outcome, tagged with the mode that actually ran. Never throws.
 */
export async function syncCollection<T>(
  spec: CollectionSpec<T>,
  options: FullWalkOptions,
): Promise<WalkOutcome> {
  const meta = await orgSnapshotStore.getMeta(spec.collection, options.origin);

  // A version mismatch outranks every cheap rung, including `refreshIntervalMs`
  // (ADR-0066 §4). A delta only rewrites rows Okta reports as changed, so it can
  // never repair a row that is merely old-shaped, and the drift check would
  // return `in-sync` across a field addition and license that delta — between
  // them they would keep the gap forever while every check reported agreement.
  // The interval does not gate this either: it exists to stop a *fresh* snapshot
  // being re-derived, and a version-mismatched snapshot is not fresh, it is
  // known-incomplete. The walk stays opportunistic in ADR-0040's sense — it runs
  // at the next sync *attempt*, at `low` priority. A bump schedules nothing; it
  // upgrades the next thing that was going to happen anyway.
  const stale = isParseVersionStale(spec, meta);
  if (stale && !options.force) {
    log.debug('Snapshot parse version behind the spec; upgrading with a full walk', {
      collection: spec.collection,
      stored: meta.parseVersion ?? null,
      expected: spec.parseVersion,
    });
  }

  const mode: SyncMode =
    options.force || stale ? 'full' : nextSyncMode(meta, options.now, spec.refreshIntervalMs);

  // A sharded collection has only two honest answers: walk the fan-out, or leave
  // it alone. There is no org-wide count to drift-check it against and no
  // listing to filter by `lastUpdated`, so the cheap rungs do not apply.
  if (spec.shards) {
    if (mode === 'none')
      return { collection: spec.collection, complete: true, written: 0, swept: 0, mode };
    return { ...(await runShardedWalk(spec, options)), mode: 'full' };
  }

  if (mode === 'full') return { ...(await runFullWalk(spec, options)), mode: 'full' };
  if (mode === 'none')
    return { collection: spec.collection, complete: true, written: 0, swept: 0, mode };

  if (mode === 'drift-check') {
    const verdict = await runDriftCheck(spec, options);
    if (verdict !== 'in-sync') {
      log.debug('Drift check escalating to a full walk', { collection: spec.collection, verdict });
      return { ...(await runFullWalk(spec, options)), mode: 'full' };
    }
    // Counts agree, so nothing was deleted — but an *edit* moves no count, so
    // the delta still has to run. The drift check answers one question only.
    return runDelta(spec, options, meta);
  }

  return runDelta(spec, options, meta);
}

/**
 * The groups collection.
 *
 * `expand=stats` gives the exact member count and `expand=app` the source app
 * for `APP_GROUP` rows — the second of which replaces one `/api/v1/apps/{id}`
 * request per unique source app, which was the single largest cost in the
 * pre-ADR-0040 Groups load. Both are named in `preserveParams` because Okta
 * echoes `expand=stats` into its `rel="next"` link but is not guaranteed to echo
 * `expand=app`; re-appending one Okta already sent is a no-op, so naming both is
 * cheaper than being wrong about either.
 */
export const GROUPS_SPEC: CollectionSpec = {
  collection: 'groups',
  firstUrl: `/api/v1/groups?limit=${OKTA_PAGE_SIZE}&expand=stats&expand=app`,
  schema: oktaGroupListItemSchema,
  // 1 is the first knowable version: rows written before ADR-0066 record none at
  // all, and version 0 cannot be asserted retroactively. Those orgs take one
  // upgrade walk on the release that adopts this, and nothing after.
  parseVersion: 1,
  preserveParams: ['expand'],
  context: 'GET /api/v1/groups',
};

/**
 * The org-wide group rules collection.
 *
 * One paginated listing for the whole org, never one request per group — the
 * property `groupDiscovery.fetchAndCacheAllGroupRules` already relied on and
 * which this inherits.
 */
export const RULES_SPEC: CollectionSpec = {
  collection: 'rules',
  firstUrl: `/api/v1/groups/rules?limit=${OKTA_PAGE_SIZE}`,
  schema: oktaGroupRuleSchema,
  parseVersion: 1,
  context: 'GET /api/v1/groups/rules',
};

/**
 * The org's application inventory.
 *
 * One paginated listing, exactly as `appOperations.getAllApps` walked it — the
 * difference is where the result lands. It is here rather than left on the
 * session-scoped `entityCache` because the Overview's questions are about the
 * *join* between apps, groups and rules ("which app-sourced groups point at a
 * deleted app?"), and a join is only cheap when both sides are local and both
 * sides are as fresh as each other.
 */
export const APPS_SPEC: CollectionSpec = {
  collection: 'apps',
  firstUrl: `/api/v1/apps?limit=${OKTA_PAGE_SIZE}`,
  schema: oktaAppListItemSchema,
  parseVersion: 1,
  context: 'GET /api/v1/apps',
};

/** How long app-group assignments may be served before the fan-out re-runs. */
const APP_GROUPS_REFRESH_MS = 6 * 60 * 60 * 1000;

/** Minimum shape this module reads off a stored group row. */
interface StoredGroupSource {
  type?: unknown;
  source?: { id?: unknown };
  _links?: { apps?: { href?: unknown } };
}

/**
 * The app an `APP_GROUP` is sourced from, by the same rule the panel's
 * `toGroupSummary` uses: `source.id` wins, and the id embedded in the
 * `_links.apps` href is the fallback.
 *
 * Deriving it differently here would make the fan-out walk a set of apps that
 * does not match the set of groups the list attributes to them — some rows would
 * show a source app that was never asked about.
 *
 * @param group - A stored group row.
 * @returns The source app id, or `null` when the group has none.
 */
function sourceAppIdOf(group: StoredGroupSource): string | null {
  if (group.type !== 'APP_GROUP') return null;
  const sourceId = group.source?.id;
  if (typeof sourceId === 'string' && sourceId !== '') return sourceId;
  const href = group._links?.apps?.href;
  if (typeof href !== 'string') return null;
  const match = href.match(/\/apps\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * Which apps to walk for group assignments — answered from the snapshot, at no
 * request cost.
 *
 * The app inventory already records each app's provisioning `features`, so the
 * apps that push groups can simply be read off it. That is also **wider** than
 * the pre-ADR-0040 pass, which derived its app set from groups of type
 * `APP_GROUP` and therefore only ever saw apps that *import* groups: an app that
 * pushes to Okta groups without importing any was invisible to it, and to both
 * push filters downstream.
 *
 * The fallback is the ADR-0040 probe discipline applied to a field instead of a
 * filter: an absent `features` array is not evidence of an absent feature, so an
 * inventory that reports the feature on no app at all falls back to the old
 * source-app derivation rather than concluding the org pushes nothing.
 *
 * @param origin - Org origin.
 * @returns One shard per app worth asking about.
 * @throws When neither source collection has been walked yet — an empty shard
 * list would otherwise be recorded as a successful empty walk, and nothing would
 * re-derive it until the refresh interval elapsed.
 */
async function pushEnabledAppShards(origin: string): Promise<Shard[]> {
  const [apps, appsMeta] = await Promise.all([
    orgSnapshotStore.getCollection<OktaAppListItem>('apps', origin),
    orgSnapshotStore.getMeta('apps', origin),
  ]);

  const appIds = new Set<string>();
  for (const app of apps) {
    if (isGroupPushApp(app.features) && app.id) appIds.add(app.id);
  }

  if (appIds.size === 0) {
    const groups = await orgSnapshotStore.getCollection<StoredGroupSource>('groups', origin);
    for (const group of groups) {
      const sourceId = sourceAppIdOf(group);
      if (sourceId) appIds.add(sourceId);
    }
    // Nothing found, and no walked inventory to have found it in. "No apps push
    // groups" and "we have not looked yet" are different facts, and recording
    // the second as the first would leave the collection empty and satisfied.
    if (appIds.size === 0 && !appsMeta.complete) {
      throw new Error('app inventory not yet walked');
    }
  }

  return [...appIds].sort().map((id) => ({
    key: id,
    firstUrl: `/api/v1/apps/${encodeURIComponent(id)}/groups?limit=${OKTA_PAGE_SIZE}`,
  }));
}

/**
 * The org's app-group assignments — which groups each app pushes or sources.
 *
 * A fan-out: Okta exposes these only per app, so this is one listing per
 * push-enabled app rather than a collection listing. It was the last thing the
 * panel re-derived on every open, roughly one request per app each time,
 * re-asking a question whose answer had been on screen minutes earlier.
 *
 * **`identify` is not optional decoration here.** Okta returns the assigned
 * *group's* id as the assignment's `id`, so two apps assigning the same group
 * both key to `[origin, <groupId>]` and the second would overwrite the first,
 * silently deleting an app's mappings because it shared a group with another.
 * The shard key — the app id — is composed in to keep them distinct.
 */
export const APP_GROUPS_SPEC: CollectionSpec = {
  collection: 'appGroups',
  // Never fetched: the shards supply the real URLs. Kept accurate because
  // `countUrl` derives a path from it, and because it documents the shape.
  firstUrl: `/api/v1/apps/{appId}/groups?limit=${OKTA_PAGE_SIZE}`,
  schema: oktaAppGroupAssignmentSchema,
  parseVersion: 1,
  context: 'GET /api/v1/apps/{appId}/groups',
  shards: pushEnabledAppShards,
  identify: (row, shard) => {
    if (!shard || typeof row !== 'object' || row === null) return null;
    const assignment = row as { id?: unknown };
    const groupId = typeof assignment.id === 'string' ? assignment.id : '';
    if (groupId === '') return null;
    // No `lastUpdated`: this endpoint does not report one, and inventing a
    // watermark for a collection that can never delta would be a lie the
    // freshness ladder would then act on.
    return { id: `${shard.key}${SHARD_KEY_SEPARATOR}${groupId}` };
  },
  refreshIntervalMs: APP_GROUPS_REFRESH_MS,
};

/**
 * Fill the snapshot for one org.
 *
 * Groups and rules are **independent collections against different endpoints**,
 * so they are walked concurrently rather than one after the other. The
 * pre-ADR-0040 loader awaited the rules listing after the group walk had
 * finished, which spent a round trip of wall clock on a queue neither collection
 * needed to be in.
 *
 * Each collection picks its own mode independently: groups may be due for a
 * cheap delta while rules still need their first full walk, and neither should
 * wait on the other's verdict.
 *
 * `force` deliberately applies to **all** of them. A person pressing Refresh is
 * saying the snapshot is wrong, and "wrong" is rarely confined to the tab they
 * happen to be looking at; the whole point of one store is one invalidation
 * story. The extra cost is the apps and rules listings — two or three requests
 * against the groups walk's five or more.
 *
 * **Derived collections wait.** `appGroups` decides *what to walk* by reading the
 * app inventory, so running it alongside the walk that fills that inventory would
 * have it ask a cold store and find nothing. It runs in a second pass, after the
 * independent collections have settled. This is the one ordering constraint in
 * the snapshot, and it is a data dependency rather than a preference.
 *
 * @param options - See {@link FullWalkOptions}.
 * @param specs - Independent collections, walked concurrently; defaults to
 * groups, rules and apps.
 * @param derivedSpecs - Collections whose shards are computed from the ones
 * above, walked after them; defaults to app-group assignments.
 * @returns One outcome per collection, independent collections first. Never
 * throws: a collection that failed reports `complete: false` and the others
 * still land.
 */
export async function syncOrg(
  options: FullWalkOptions,
  specs: ReadonlyArray<CollectionSpec> = [GROUPS_SPEC, RULES_SPEC, APPS_SPEC],
  derivedSpecs: ReadonlyArray<CollectionSpec> = [APP_GROUPS_SPEC],
): Promise<WalkOutcome[]> {
  const independent = await Promise.all(specs.map((spec) => syncCollection(spec, options)));
  const derived = await Promise.all(derivedSpecs.map((spec) => syncCollection(spec, options)));
  return [...independent, ...derived];
}
