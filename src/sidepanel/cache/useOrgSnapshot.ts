/**
 * @module sidepanel/cache/useOrgSnapshot
 * @description The panel's read side of the background-owned org snapshot
 * (ADR-0040).
 *
 * The panel no longer *asks* for a collection and waits — it reads what the
 * background already stored, and repaints as the background writes more. Three
 * behaviours follow, and they are the whole point of the hook:
 *
 * - **A warm org paints before a single request is issued.** The first render
 *   after the IndexedDB read shows real rows; there is no request on that path.
 * - **A cold org paints per page.** The background broadcasts `snapshotUpdated`
 *   as each page lands, and this re-reads, so rows appear about a second in
 *   rather than after the whole walk.
 * - **A partial walk is labelled partial.** `complete` reports whether the last
 *   walk finished, so a caller can caveat rather than render a truncated
 *   inventory as the org (ADR-0040 §7).
 *
 * It is deliberately *not* built on {@link module:sidepanel/cache/entityCache}:
 * that cache is in-memory, session-scoped and panel-owned, which is precisely the
 * ownership this replaces. The two coexist — `entityCache` still serves
 * per-entity reads like a group's members.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { orgSnapshotStore } from '../../shared/snapshot/orgSnapshotStore';
import type { SnapshotCollection } from '../../shared/snapshot/types';
import { createLogger } from '../../shared/utils/logger';

const log = createLogger('useOrgSnapshot');

/** What {@link useOrgSnapshot} exposes for one collection. */
export interface UseOrgSnapshotResult<T> {
  /** The stored rows for this org and collection; `[]` before the first read. */
  rows: T[];
  /** `true` until the first IndexedDB read for the current org resolves. */
  isReading: boolean;
  /** Whether the last walk for this collection finished (ADR-0040 §7). */
  complete: boolean;
  /** Epoch millis of the last completed full walk, or `null` when never. */
  lastFullWalkAt: number | null;
  /** `true` while a sync requested from here is in flight. */
  isSyncing: boolean;
  /** Message from the last failed sync, or `null`. */
  error: string | null;
  /**
   * Ask the background to sync this org.
   *
   * @param force - Skip the cheap delta/drift modes and walk the org in full.
   * What a user-pressed Refresh means; a background top-up leaves it off.
   * @returns The failure message, or `null` on success. Returned as well as
   * held in {@link UseOrgSnapshotResult.error} because a caller awaiting the
   * sync cannot read the post-settle state value — it would still be the render
   * that started the sync.
   */
  sync: (force?: boolean) => Promise<string | null>;
}

/** Options for {@link useOrgSnapshot}. */
export interface UseOrgSnapshotOptions {
  /**
   * When `false`, the hook still reads the store and still tracks broadcasts,
   * but {@link UseOrgSnapshotResult.sync} is a no-op. Used to keep a hidden tab
   * from driving org-wide traffic nobody is looking at (ADR-0018 / ADR-0026).
   */
  enabled?: boolean;
}

/** The background's per-page progress broadcast. */
interface SnapshotUpdatedBroadcast {
  action?: unknown;
  origin?: unknown;
  collection?: unknown;
}

/**
 * Read one collection of one org's snapshot, staying live as the background
 * fills it.
 *
 * @typeParam T - The stored entity type (e.g. a raw Okta group).
 * @param collection - Which collection to read.
 * @param origin - Connected org origin; `null` before it resolves, which reads
 * nothing rather than reading some other org's rows.
 * @param tabId - Live Okta tab the background routes requests through; `null`
 * disables syncing, since the background cannot fetch Okta without one.
 * @param options - See {@link UseOrgSnapshotOptions}.
 * @returns See {@link UseOrgSnapshotResult}.
 */
export function useOrgSnapshot<T>(
  collection: SnapshotCollection,
  origin: string | null | undefined,
  tabId: number | null,
  options: UseOrgSnapshotOptions = {},
): UseOrgSnapshotResult<T> {
  const { enabled = true } = options;

  const [rows, setRows] = useState<T[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [lastFullWalkAt, setLastFullWalkAt] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards every async settle against an org change that happened mid-read. A
  // late resolve must never write one org's rows into another org's render —
  // the failure `useAppsData` documents for its own cache key.
  const originRef = useRef(origin);
  originRef.current = origin;

  const readSnapshot = useCallback(async () => {
    if (!origin) {
      setRows([]);
      setComplete(false);
      setLastFullWalkAt(null);
      return;
    }
    const [stored, meta] = await Promise.all([
      orgSnapshotStore.getCollection<T>(collection, origin),
      orgSnapshotStore.getMeta(collection, origin),
    ]);
    if (originRef.current !== origin) return;
    setRows(stored);
    setComplete(meta.complete);
    setLastFullWalkAt(meta.lastFullWalkAt);
  }, [collection, origin]);

  // Seed from the store whenever the org changes. This is the read that makes a
  // returning visit cost nothing: it paints real rows with no request behind it.
  useEffect(() => {
    let cancelled = false;
    setIsReading(true);
    // Blank the previous org's rows immediately rather than after the read: they
    // must not linger on screen under the new org's identity.
    setRows([]);
    void readSnapshot().finally(() => {
      if (!cancelled) setIsReading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [readSnapshot]);

  // Repaint as the background writes. The broadcast carries counts only, so the
  // rows are re-read from the store rather than taken from the message.
  useEffect(() => {
    if (!origin) return;
    const listener = (message: SnapshotUpdatedBroadcast): void => {
      if (message?.action !== 'snapshotUpdated') return;
      if (message.origin !== origin || message.collection !== collection) return;
      void readSnapshot();
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [collection, origin, readSnapshot]);

  const sync = useCallback(
    async (force = false): Promise<string | null> => {
      if (!origin || tabId === null) return 'No Okta tab connected';
      if (!enabled) return null;
      setIsSyncing(true);
      setError(null);
      let failure: string | null = null;
      try {
        const response = (await chrome.runtime.sendMessage({
          action: 'syncSnapshot',
          origin,
          tabId,
          force,
        })) as { success?: boolean; error?: string } | undefined;
        if (!response?.success) {
          failure = response?.error || 'Failed to load from Okta';
        }
        // Re-read regardless of the verdict: a failed walk still wrote every page
        // it did reach, and those rows are real.
        await readSnapshot();
      } catch (err) {
        failure = err instanceof Error ? err.message : 'Failed to load from Okta';
        // Identifiers and outcomes only — never an entity name or a response body.
        log.error('Snapshot sync request failed', { code: 'snapshot_sync_failed', collection });
      } finally {
        setError(failure);
        setIsSyncing(false);
      }
      return failure;
    },
    [collection, enabled, origin, readSnapshot, tabId],
  );

  return { rows, isReading, complete, lastFullWalkAt, isSyncing, error, sync };
}
