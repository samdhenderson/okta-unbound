/**
 * @module background/snapshotScheduler
 * @description Decides *when* the org snapshot is topped up (ADR-0040 §2).
 *
 * The background cannot fetch Okta — every request exits through a content
 * script in a logged-in Okta tab — so this is not a scheduler in the usual sense.
 * It cannot decide that a sync will happen; it can only notice that one is
 * currently *possible* and take the chance. Two things create that chance:
 *
 * - **An Okta tab finishing a navigation.** The likeliest moment a live session
 *   exists, and the moment an admin is most likely to open the panel next.
 * - **A periodic alarm.** `chrome.alarms` survives service-worker suspension
 *   where `setInterval` does not, so a long-lived Okta tab still gets its drift
 *   check even if the admin never navigates. The alarm only *re-arms an
 *   attempt*; the attempt no-ops when no Okta tab exists.
 *
 * What it deliberately does not decide is **how much** to sync. That is
 * {@link module:shared/snapshot/syncMeta}'s freshness ladder, reached through
 * `syncSnapshot`, and it is normally one request or none. This module's only job
 * is to keep the attempts rare enough that browsing the admin console does not
 * turn into a request per page view.
 *
 * @see {@link module:background/snapshotBridge} for the transport and the
 * origin verification every attempt passes through.
 */

import type { ApiScheduler } from '../shared/scheduler/apiScheduler';
import { syncSnapshot } from './snapshotBridge';
import { oktaOriginOf } from '../shared/utils/oktaUrl';
import { createLogger } from '../shared/utils/logger';

const log = createLogger('SnapshotScheduler');

/** Periodic alarm that re-arms an attempt for any open Okta tab. */
export const SNAPSHOT_SYNC_ALARM = 'snapshotSync';

/**
 * How long an Okta tab must sit still before an attempt is made.
 *
 * An admin console navigation fires several `onUpdated` events, and following a
 * link fires another set moments later. Waiting lets a burst of them collapse
 * into one attempt.
 */
export const TAB_SETTLE_DEBOUNCE_MS = 3_000;

/**
 * The floor between two attempts for the same org.
 *
 * Without it, every page view in the admin console would resolve to a delta —
 * one request each, forever, for an admin who is doing nothing but browsing.
 * The freshness ladder is cheap, not free, and this is what bounds it.
 */
export const MIN_ATTEMPT_INTERVAL_MS = 60_000;

/** How often the alarm re-arms; matches the drift-check cadence. */
export const SNAPSHOT_ALARM_PERIOD_MINUTES = 15;

/** Injected seams, so the policy is testable without Chrome timers. */
export interface SnapshotSchedulerDeps {
  /** The background scheduler every request is routed through. */
  scheduler: ApiScheduler;
  /** Overridden in tests; defaults to the real bridge. */
  sync?: typeof syncSnapshot;
  /** Overridden in tests; defaults to `Date.now`. */
  now?: () => number;
  /** Debounce window; overridden in tests to keep them fast. */
  debounceMs?: number;
}

/** What {@link createSnapshotScheduler} exposes. */
export interface SnapshotSchedulerHandlers {
  /** `chrome.tabs.onUpdated` handler. */
  onTabUpdated: (
    tabId: number,
    changeInfo: chrome.tabs.OnUpdatedInfo,
    tab: chrome.tabs.Tab,
  ) => void;
  /** `chrome.alarms.onAlarm` handler. */
  onAlarm: (alarm: chrome.alarms.Alarm) => Promise<void>;
}

/**
 * Build the trigger policy.
 *
 * @param deps - See {@link SnapshotSchedulerDeps}.
 * @returns Handlers to register, kept separate from registration so a test can
 * drive them directly.
 */
export function createSnapshotScheduler(deps: SnapshotSchedulerDeps): SnapshotSchedulerHandlers {
  const { scheduler } = deps;
  const sync = deps.sync ?? syncSnapshot;
  const now = deps.now ?? (() => Date.now());
  const debounceMs = deps.debounceMs ?? TAB_SETTLE_DEBOUNCE_MS;

  /** Debounce timer per origin, so a burst of navigations collapses into one. */
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  /** When each origin was last attempted, for the interval floor. */
  const lastAttemptAt = new Map<string, number>();

  /**
   * Take the chance, if it is still a chance and not too soon.
   *
   * @param origin - Org origin to sync.
   * @param tabId - Tab whose content script would issue the requests.
   */
  async function attempt(origin: string, tabId: number): Promise<void> {
    const at = now();
    const last = lastAttemptAt.get(origin);
    if (last !== undefined && at - last < MIN_ATTEMPT_INTERVAL_MS) return;
    // Stamped before the await, not after: two navigations landing inside the
    // same tick would otherwise both read a stale `last` and both attempt.
    lastAttemptAt.set(origin, at);

    try {
      // Never forced. A background top-up takes the cheapest mode the freshness
      // ladder allows; only a person pressing Refresh gets a full walk.
      await sync(scheduler, origin, tabId, at, false);
    } catch (error) {
      // Expected, routinely: the tab may have navigated away between the
      // debounce firing and the origin check, which `syncSnapshot` rejects by
      // design. Identifiers and outcome codes only — never the tab's URL, which
      // carries the org's tenant identifier.
      log.debug('Opportunistic snapshot sync did not run', {
        code: 'snapshot_attempt_skipped',
        tabId,
        reason: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  /**
   * Schedule an attempt for an Okta tab that just settled.
   *
   * @param origin - Org origin parsed from the tab's URL.
   * @param tabId - The tab.
   */
  function scheduleAttempt(origin: string, tabId: number): void {
    const existing = timers.get(origin);
    if (existing !== undefined) clearTimeout(existing);
    timers.set(
      origin,
      setTimeout(() => {
        timers.delete(origin);
        // Deliberately not re-checked here: the tab may have navigated away in
        // the meantime, and `syncSnapshot` verifies the tab is still on this
        // origin before issuing anything. One check, in the place that can act
        // on it (ADR-0040 §7).
        void attempt(origin, tabId);
      }, debounceMs),
    );
  }

  return {
    onTabUpdated: (tabId, changeInfo, tab) => {
      if (changeInfo.status !== 'complete') return;
      // Hostname-parsed, never substring-matched (docs/security.md). A tab the
      // extension has no host permission for reports no URL at all, which is
      // also not an Okta origin.
      const origin = oktaOriginOf(tab.url);
      if (!origin) return;
      scheduleAttempt(origin, tabId);
    },

    onAlarm: async (alarm) => {
      if (alarm.name !== SNAPSHOT_SYNC_ALARM) return;
      const tabs = await chrome.tabs.query({});
      // One attempt per origin, not per tab: three tabs open on the same org are
      // three routes to the same inventory, and `syncSnapshot` would collapse
      // them anyway — but not before paying for the collapse.
      const byOrigin = new Map<string, number>();
      for (const tab of tabs) {
        const origin = oktaOriginOf(tab.url);
        if (origin && tab.id !== undefined && !byOrigin.has(origin)) {
          byOrigin.set(origin, tab.id);
        }
      }
      if (byOrigin.size === 0) return;
      log.debug('Alarm re-arming snapshot attempts', { origins: byOrigin.size });
      await Promise.all([...byOrigin].map(([origin, tabId]) => attempt(origin, tabId)));
    },
  };
}

/**
 * Register the trigger policy against the real Chrome surfaces.
 *
 * @param scheduler - The background scheduler.
 * @remarks Uses `chrome.alarms`, already granted in `manifest.json`, and
 * `chrome.tabs.onUpdated`, which needs no permission of its own — the tab's URL
 * is only readable because of the Okta host permissions the extension already
 * holds. **No manifest change.**
 */
export function startSnapshotScheduler(scheduler: ApiScheduler): void {
  const handlers = createSnapshotScheduler({ scheduler });
  chrome.tabs.onUpdated.addListener(handlers.onTabUpdated);
  chrome.alarms.onAlarm.addListener((alarm) => void handlers.onAlarm(alarm));
  chrome.alarms.create(SNAPSHOT_SYNC_ALARM, {
    periodInMinutes: SNAPSHOT_ALARM_PERIOD_MINUTES,
  });
  log.debug('Snapshot scheduler started');
}
