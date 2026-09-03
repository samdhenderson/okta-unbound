/**
 * @module sidepanel/export/snapshot
 * @description The read-only view of the org snapshot a snapshot-sourced
 * descriptor is handed (ADR-0065 §3).
 *
 * **A snapshot source reads; it never syncs.** This view is deliberately the
 * narrowest projection of `useOrgEntityIndex`'s handles that a join can work
 * from: the stored rows, the record ids for the one collection whose key carries
 * meaning, and the four read-state fields
 * {@link module:sidepanel/components/home/orgFigures.figureStatus} classifies a
 * collection with. It exposes **no `sync`**, so an export cannot issue a request,
 * mount a listener, or trigger a top-up even by accident —
 * {@link module:sidepanel/hooks/useOrgFigures} keeps sole ownership of the one
 * top-up a mount is allowed to spend (ADR-0040).
 *
 * Rows are typed `unknown` on purpose. Cached Okta responses sit in plaintext
 * IndexedDB and a round-trip through disk makes nothing trustworthy, so a
 * descriptor validates them with `parseOktaList` before reading a field
 * (ADR-0006, ADR-0065 §4). Typing them here would hand a descriptor a shape
 * nobody checked.
 *
 * This module logs nothing.
 */

import type { FigureSource } from '../components/home/orgFigures';

/** One mounted collection, read-only. */
export interface SnapshotCollection {
  /** The stored rows for this org and collection; `[]` before the first read. */
  rows: readonly unknown[];
  /**
   * The same rows with their storage envelope, for the one collection whose key
   * carries meaning the entity does not (`appGroups`, keyed `${appId}::${groupId}`).
   */
  records: readonly { id: string }[];
  /** `true` until the first IndexedDB read for the current org resolves. */
  isReading: boolean;
  /** Whether the last walk for this collection finished (ADR-0040 §7). */
  complete: boolean;
  /** Epoch millis of the last completed full walk, or `null` when never. */
  lastFullWalkAt: number | null;
  /** Message from the last failed sync, or `null`. */
  error?: string | null;
  /** HTTP status of the most recent sync attempt, or `null` (D-068). */
  status?: number | null;
}

/** The four collections a report-shaped descriptor joins over. */
export interface OrgSnapshotView {
  /** `/api/v1/groups` rows. */
  groups: SnapshotCollection;
  /** `/api/v1/groups/rules` rows. */
  rules: SnapshotCollection;
  /** `/api/v1/apps` rows. */
  apps: SnapshotCollection;
  /** `/api/v1/apps/{id}/groups` rows, read through `records`. */
  appGroups: SnapshotCollection;
}

/**
 * Project a collection onto the completeness vocabulary `resolveCount` speaks.
 *
 * The same projection `useHomeReports` makes, so a report's number on Home and
 * the same report's export cannot disagree about whether a collection was read.
 *
 * @param collection - The mounted collection.
 * @returns The {@link FigureSource} for it.
 */
export function collectionSource(collection: SnapshotCollection): FigureSource {
  return {
    isReading: collection.isReading,
    complete: collection.complete,
    lastFullWalkAt: collection.lastFullWalkAt,
    count: collection.rows.length,
    error: collection.error ?? null,
    status: collection.status ?? null,
  };
}
