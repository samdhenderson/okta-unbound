/**
 * @module background/snapshotBridge
 * @description Wires the org snapshot's collection walks to the background
 * `ApiScheduler` and announces progress to the side panel (ADR-0040).
 *
 * `shared/snapshot/snapshotSync` deliberately owns no transport and touches no
 * `chrome.*`, so this is the seam where it meets both. Three jobs:
 *
 * - Adapt {@link PageRequest} onto `ApiScheduler.scheduleRequest` at **`low`**
 *   priority, so a background walk can never starve a user-typed search (the
 *   scheduler's `interactive` tier already jumps the queue past it).
 * - Hold **one sync per origin** at a time, so a panel reopening while a walk is
 *   already running joins it instead of starting a second one over the same
 *   pages.
 * - Broadcast `snapshotUpdated` per page, which is what lets the panel paint
 *   mid-walk rather than after it.
 *
 * The background cannot fetch Okta itself; every request exits through the
 * content script in a live Okta tab, which is why a `tabId` is required and why
 * sync is opportunistic rather than scheduled (ADR-0040 §2).
 */

import type { ApiScheduler } from '../shared/scheduler/apiScheduler';
import { syncOrg, type PageRequest, type WalkOutcome } from '../shared/snapshot/snapshotSync';
import type { SnapshotCollection } from '../shared/snapshot/types';
import { createLogger } from '../shared/utils/logger';
import { oktaOriginOf } from '../shared/utils/oktaUrl';

const log = createLogger('SnapshotBridge');

/**
 * Broadcast telling the side panel a collection grew. Carries counts only —
 * never rows, which are read back from IndexedDB by the panel itself.
 */
export interface SnapshotUpdatedMessage {
  action: 'snapshotUpdated';
  /** Org the rows belong to; the panel ignores broadcasts for another org. */
  origin: string;
  /** Which collection changed. */
  collection: SnapshotCollection;
  /** Rows written so far in this walk. */
  loaded: number;
  /** Whether the walk has finished. */
  complete: boolean;
}

/** In-flight sync per origin, so a second request joins rather than duplicates. */
const inFlight = new Map<string, { run: Promise<WalkOutcome[]>; force: boolean }>();

/**
 * Confirm the tab that will perform the fetches is actually on the org the rows
 * will be filed under.
 *
 * The caller supplies both the `origin` (which keys the IndexedDB rows) and the
 * `tabId` (whose content script issues every request), and **nothing else ties
 * the two together**. The content script fetches relative to its own page
 * origin, not to the string the caller passed, so a caller whose `origin` has
 * gone stale — the "one Chrome tab navigates from org A to org B" race that
 * ADR-0040 §1 names as the reason to scope by origin at all — would file org
 * B's groups under org A's key. That is cross-org contamination of the store
 * this ADR exists to make trustworthy, so it is checked here rather than
 * trusted from the panel.
 *
 * @param origin - The org origin the caller claims the tab is on.
 * @param tabId - The tab that would issue the requests.
 * @returns `true` when the tab's live URL parses to exactly `origin`.
 * @remarks A tab that cannot be read (closed, or no URL granted) fails closed —
 * an unverifiable claim is not a verified one.
 */
async function tabIsOnOrigin(origin: string, tabId: number): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId);
    // Parsed through the shared helper, never substring-matched and never a
    // second hand-rolled `new URL()` (`shared/utils/oktaUrl`, docs/security.md).
    // A tab that is not on an Okta host at all yields `null`, which no valid
    // origin equals.
    return oktaOriginOf(tab?.url) === origin;
  } catch {
    return false;
  }
}

/**
 * Announce a snapshot change to every extension context.
 *
 * @param message - The broadcast payload.
 * @remarks Rejections are swallowed: with the side panel closed there is no
 * receiver, and that is the normal case for a background sync, not an error.
 */
function broadcast(message: SnapshotUpdatedMessage): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // No listener (side panel closed) — expected for a background sync.
  });
}

/**
 * Build a scheduler-routed page transport bound to one Okta tab.
 *
 * @param scheduler - The background scheduler; all Okta traffic goes through it.
 * @param tabId - Tab whose content script performs the fetch.
 * @returns A {@link PageRequest} issuing `GET`s at `low` priority.
 * @remarks A rejected schedule (a dropped message port, a cancelled queue) is
 * turned into a `success: false` result rather than being allowed to throw, so
 * the walk records it as an incomplete page and keeps its resume cursor instead
 * of unwinding with a partially written snapshot and no way back.
 */
export function createSchedulerPageRequest(scheduler: ApiScheduler, tabId: number): PageRequest {
  return async (url, reason) => {
    try {
      const result = await scheduler.scheduleRequest(url, 'GET', undefined, tabId, 'low', reason);
      return {
        success: result.success,
        data: result.data,
        headers: result.headers,
        error: result.error,
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Request failed' };
    }
  };
}

/**
 * Fill one org's snapshot, joining an existing run rather than duplicating it.
 *
 * @param scheduler - The background scheduler.
 * @param origin - Org origin the rows are scoped to.
 * @param tabId - Live Okta tab to route requests through.
 * @param now - Epoch millis; injected so the walk's mark stays testable.
 * @param force - Skip the cheap modes; what the Refresh button means.
 * @returns One {@link WalkOutcome} per collection. Never throws.
 * @throws Error when `tabId` is not on `origin` — see {@link tabIsOnOrigin}.
 * Deliberately a rejection rather than a silent no-op: the caller asked for one
 * org's inventory and would otherwise be told a walk had succeeded.
 */
export async function syncSnapshot(
  scheduler: ApiScheduler,
  origin: string,
  tabId: number,
  now: number = Date.now(),
  force = false,
): Promise<WalkOutcome[]> {
  const existing = inFlight.get(origin);
  if (existing && (existing.force || !force)) {
    // Joining is only honest while the run already underway is at least as
    // thorough as the one being asked for. A Refresh that quietly attached
    // itself to a background delta would report a full walk it never got.
    log.debug('Joining an in-flight snapshot sync');
    return existing.run;
  }
  if (existing) {
    // A forced request arriving behind a cheap one: the cheap run cannot be
    // cancelled, so the full walk queues behind it rather than racing it over
    // the same pages.
    log.debug('Queueing a forced sync behind an in-flight one');
    await existing.run.catch(() => undefined);
  }

  if (!(await tabIsOnOrigin(origin, tabId))) {
    // Identifiers and outcomes only — never the tab's URL, which carries the
    // org's tenant identifier.
    log.warn('Refusing snapshot sync: tab is not on the requested origin', {
      code: 'snapshot_origin_mismatch',
      tabId,
    });
    throw new Error('The connected tab is no longer on this Okta org');
  }

  // Re-checked after the await: a second caller may have started a run for this
  // origin while `chrome.tabs.get` was in flight, and two concurrent full walks
  // of the same org would double its request cost for no extra data.
  const raced = inFlight.get(origin);
  if (raced && (raced.force || !force)) return raced.run;

  const run = syncOrg({
    origin,
    now,
    force,
    request: createSchedulerPageRequest(scheduler, tabId),
    onPage: (collection, loaded) =>
      broadcast({ action: 'snapshotUpdated', origin, collection, loaded, complete: false }),
  })
    .then((outcomes) => {
      for (const outcome of outcomes) {
        broadcast({
          action: 'snapshotUpdated',
          origin,
          collection: outcome.collection,
          loaded: outcome.written,
          complete: outcome.complete,
        });
      }
      // Collections and counts only — never a group name or a response body.
      log.debug('Snapshot sync settled', {
        outcomes: outcomes.map((o) => ({
          collection: o.collection,
          mode: o.mode,
          complete: o.complete,
          written: o.written,
          swept: o.swept,
        })),
      });
      return outcomes;
    })
    .finally(() => {
      // Cleared in `finally` rather than in `then`, so a rejection cannot leave a
      // dead promise latched and block every later sync for this origin.
      inFlight.delete(origin);
    });

  inFlight.set(origin, { run, force });
  return run;
}
