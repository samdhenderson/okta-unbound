/**
 * @module background/rateLimitThreshold
 * @description Learns each connected org's rate-limit warning threshold once and
 * hands it to the global `ApiScheduler`, so the cooldown trigger is the number
 * the org chose rather than a hardcoded guess.
 *
 * ## Why this is background-owned
 *
 * The scheduler it configures lives here, and so does the traffic that needs
 * protecting: the snapshot walks run from alarms with no side panel open at all.
 * Wiring this from the panel would leave the background's own fan-outs steering
 * on the default.
 *
 * ## What it costs
 *
 * At most **one request per org per browser session**. The answer is memoised in
 * `chrome.storage.session`, which is deliberately the same lifetime as the
 * scheduler config it feeds: it survives MV3 service-worker suspension (so a
 * worker that wakes re-applies the threshold instead of re-asking) and dies with
 * the browser (so a changed org setting is picked up without a manual reset).
 *
 * A **failure is memoised too**. Rate Limit Settings is a Super Admin surface,
 * so an admin with a narrower role gets 403 on every attempt — re-probing per
 * request would spend a request each time to learn the same thing. The next
 * browser session asks again, which is when a role change would have taken
 * effect anyway.
 *
 * The probe goes through `scheduleRequest` like every other Okta call: it is
 * rate-limited, audited, and lands in the `/api/v1/rate-limit-settings` bucket
 * rather than competing with the app or group traffic it exists to protect.
 *
 * Nothing here logs a response body — an outcome code and the integer threshold
 * only.
 */

import type { ApiScheduler } from '../shared/scheduler/apiScheduler';
import {
  WARNING_THRESHOLD_ENDPOINT,
  minRemainingFromWarningThreshold,
  parseWarningThreshold,
} from '../shared/scheduler/rateLimitSettings';
import { createLogger } from '../shared/utils/logger';
import { oktaOriginOf } from '../shared/utils/oktaUrl';

const log = createLogger('RateLimitThreshold');

/** `chrome.storage.session` key holding one org's resolved threshold. */
function storageKey(origin: string): string {
  return `rateLimitThreshold:${origin}`;
}

/**
 * What a completed probe recorded for an org: the percentage-remaining to cool
 * down at, or `null` when the org did not give a usable answer.
 */
type MemoisedThreshold = { minRemaining: number | null };

/**
 * Origins whose probe is in flight right now, so a burst of requests against a
 * cold org issues one probe rather than one per request. Deliberately in memory:
 * it describes this worker's live work, not a durable fact.
 */
const inFlight = new Set<string>();

/**
 * Resolve the Okta origin a tab is on.
 *
 * The origin is parsed from the tab's URL rather than taken from the message,
 * because `scheduleApiRequest` carries no origin — and it is validated as an
 * Okta host by `oktaOriginOf`, so a tab that has navigated somewhere else can
 * never key an entry (`docs/security.md` §6).
 *
 * @param tabId - The tab whose content script would perform the fetch.
 * @returns The origin, or `null` when the tab is gone or is not an Okta tab.
 */
async function originOfTab(tabId: number): Promise<string | null> {
  try {
    const tab = await chrome.tabs.get(tabId);
    return oktaOriginOf(tab.url);
  } catch {
    return null;
  }
}

/** Read this org's memoised probe result, or `null` when it has not run. */
async function readMemo(origin: string): Promise<MemoisedThreshold | null> {
  try {
    const key = storageKey(origin);
    const stored = await chrome.storage.session.get([key]);
    const value = stored[key] as MemoisedThreshold | undefined;
    if (!value || typeof value !== 'object') return null;
    const { minRemaining } = value;
    if (minRemaining === null) return { minRemaining: null };
    return typeof minRemaining === 'number' ? { minRemaining } : null;
  } catch {
    // Session storage being unavailable is not worth failing a request over;
    // it just means the probe runs again.
    return null;
  }
}

/** Record this org's probe result for the rest of the browser session. */
async function writeMemo(origin: string, memo: MemoisedThreshold): Promise<void> {
  try {
    await chrome.storage.session.set({ [storageKey(origin)]: memo });
  } catch {
    // Same: a memo we could not write costs a repeat probe, nothing more.
  }
}

/**
 * Ask the org for its warning threshold and apply the implied cooldown trigger.
 *
 * @param scheduler - The scheduler to configure, and the transport for the probe.
 * @param origin - Validated Okta origin, used only as the memo key.
 * @param tabId - Tab whose content script performs the fetch.
 */
async function probe(scheduler: ApiScheduler, origin: string, tabId: number): Promise<void> {
  let minRemaining: number | null = null;
  let code = 'rate_limit_threshold_unusable';

  try {
    const result = await scheduler.scheduleRequest(
      WARNING_THRESHOLD_ENDPOINT,
      'GET',
      undefined,
      tabId,
      'low',
      'Read org rate-limit threshold',
    );

    if (!result.success) {
      // 403 is the expected answer for an admin who is not a Super Admin, and
      // is not an error: the default threshold simply stands.
      code = 'rate_limit_threshold_unavailable';
      log.info('Org rate-limit threshold not readable', { code, status: result.status });
    } else {
      const warningThreshold = parseWarningThreshold(result.data);
      if (warningThreshold === null) {
        log.warn('Org rate-limit threshold was not usable', { code });
      } else {
        minRemaining = minRemainingFromWarningThreshold(warningThreshold);
        code = 'rate_limit_threshold_applied';
        log.info('Org rate-limit threshold applied', { code, warningThreshold, minRemaining });
      }
    }
  } catch {
    // A transport failure says nothing about the setting, so it is memoised the
    // same as any other unusable answer: the default stands until next session.
    code = 'rate_limit_threshold_failed';
    log.warn('Org rate-limit threshold probe failed', { code });
  }

  if (minRemaining !== null) scheduler.setMinRemainingThreshold(minRemaining);
  await writeMemo(origin, { minRemaining });
}

/**
 * Make sure the scheduler is using this org's threshold, probing for it once.
 *
 * Safe to call on every inbound request: a memoised org re-applies its stored
 * value and issues nothing, and a probe already in flight is joined rather than
 * duplicated.
 *
 * **Never awaited by the caller, and never allowed to reject.** A request must
 * not wait on — or be failed by — an optional refinement of the backoff policy.
 *
 * @param scheduler - The global scheduler.
 * @param tabId - Tab the inbound request will be performed on.
 */
export function ensureRateLimitThreshold(scheduler: ApiScheduler, tabId: number): void {
  void (async () => {
    const origin = await originOfTab(tabId);
    if (origin === null) return;

    const memo = await readMemo(origin);
    if (memo !== null) {
      // Re-applied rather than assumed: an MV3 worker that suspended and woke
      // has a fresh scheduler holding the configured default again.
      if (memo.minRemaining !== null) scheduler.setMinRemainingThreshold(memo.minRemaining);
      return;
    }

    if (inFlight.has(origin)) return;
    inFlight.add(origin);
    try {
      await probe(scheduler, origin, tabId);
    } finally {
      inFlight.delete(origin);
    }
  })();
}

/**
 * Forget every memoised threshold. Test seam only — `chrome.storage.session` is
 * per browser session, so production never needs this.
 */
export function resetRateLimitThresholdMemo(): void {
  inFlight.clear();
}
