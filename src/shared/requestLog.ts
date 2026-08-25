/**
 * @module shared/requestLog
 * @description Persists a rolling, verbose log of every Okta API request made,
 * grouped by the human-readable reason a caller gave.
 *
 * The background service worker's {@link ApiScheduler} is the single point
 * every request passes through — both side-panel-initiated calls and the
 * background's own org inventory sync — so it is also the only place that can
 * see the whole traffic picture. `recordRequest` is called once per settled
 * request (final success, or final failure after retries are exhausted — a
 * mid-flight retry is not itself recorded). Requests sharing a reason are
 * folded into one open batch instead of one row per request; a batch flushes
 * to storage only when {@link flushAllPending} is called, which the scheduler
 * does at the exact moment it goes fully idle (see `apiScheduler.ts`'s
 * `drainQueue`) — the same moment it lets the MV3 service worker suspend. That
 * makes flushing tied to a real lifecycle event instead of an independent
 * timer, so an open batch is never silently lost to worker suspension.
 *
 * Entries persist to `chrome.storage.local` under `apiRequestLog`,
 * newest-first, capped at {@link MAX_REQUEST_LOG_SIZE} — a batch of any size
 * still occupies exactly one slot, matching how `shared/undoManager` caps its
 * own history. Endpoint strings are redacted with `shared/utils/redact` before
 * they ever reach storage, since an admin-typed search/filter query string can
 * carry PII.
 *
 * A request coalesced onto an in-flight identical GET (`ApiScheduler`'s
 * dedup) is not separately recorded here — only the leader that actually hit
 * the network is. Known, minor limitation: a joined waiter's own reason does
 * not get its own audit entry.
 *
 * @see {@link recordRequest}
 * @see {@link flushAllPending}
 * @see {@link getRequestLog}
 */

import { createLogger } from './utils/logger';
import { redactJson } from './utils/redact';
import type {
  RequestLogEndpoint,
  RequestLogEntry,
  RequestLogHistory,
  RequestLogOutcome,
} from './requestLogTypes';

const log = createLogger('RequestLog');

const REQUEST_LOG_STORAGE_KEY = 'apiRequestLog';
const MAX_REQUEST_LOG_SIZE = 50;

/**
 * Most distinct endpoints kept per batch entry. A larger batch still records
 * its true `requestCount`; `endpoints` becomes a truncated, representative
 * sample and {@link RequestLogEntry.endpointsTruncated} says so.
 */
export const MAX_LOGGED_ENDPOINTS = 20;

const FALLBACK_REASON = 'Unlabeled request';

/**
 * Bounds a `reason` string so a malformed/huge value can't bloat storage.
 * Enforced here too, not only at `background/index.ts`'s message boundary —
 * `recordRequest` is also reachable from trusted-but-fallible internal
 * callers (the background's own org-inventory sync), so the guarantee should
 * not depend on every caller having gone through that one message handler.
 */
const MAX_REASON_LENGTH = 80;

/** One request's settle-time facts, as seen by the scheduler. */
export interface SettledRequest {
  /** Caller-supplied "why". Falls back to a generic label when absent. */
  reason?: string;
  method: string;
  endpoint: string;
  /** When the request was first scheduled (not this attempt's start). */
  timestamp: number;
  /** Wall-clock time from scheduling to this settle, including any retries. */
  durationMs: number;
  success: boolean;
}

interface PendingBatch {
  reason: string;
  requestCount: number;
  endpoints: Map<string, RequestLogEndpoint>;
  /** Uncapped count of distinct endpoints seen, to detect truncation of `endpoints`. */
  distinctEndpointCount: number;
  firstTimestamp: number;
  lastSettledAt: number;
  successCount: number;
  failureCount: number;
}

const pending = new Map<string, PendingBatch>();

/**
 * Record one settled request, folding it into the open batch for its reason
 * (opening a new batch if none is open). Call once per request, on both
 * success and final failure — never on a mid-flight retry.
 */
export function recordRequest(request: SettledRequest): void {
  const reason = (request.reason?.trim() || FALLBACK_REASON).slice(0, MAX_REASON_LENGTH);
  const redactedEndpoint = redactJson(request.endpoint).data as string;

  let batch = pending.get(reason);
  if (!batch) {
    batch = {
      reason,
      requestCount: 0,
      endpoints: new Map(),
      distinctEndpointCount: 0,
      firstTimestamp: request.timestamp,
      lastSettledAt: request.timestamp,
      successCount: 0,
      failureCount: 0,
    };
    pending.set(reason, batch);
  }

  batch.requestCount += 1;
  batch.lastSettledAt = Math.max(batch.lastSettledAt, request.timestamp + request.durationMs);
  if (request.success) {
    batch.successCount += 1;
  } else {
    batch.failureCount += 1;
  }

  const endpointKey = `${request.method} ${redactedEndpoint}`;
  if (!batch.endpoints.has(endpointKey)) {
    batch.distinctEndpointCount += 1;
    if (batch.endpoints.size < MAX_LOGGED_ENDPOINTS) {
      batch.endpoints.set(endpointKey, { method: request.method, endpoint: redactedEndpoint });
    }
  }
}

function outcomeOf(batch: PendingBatch): RequestLogOutcome {
  if (batch.failureCount === 0) return 'all';
  if (batch.successCount === 0) return 'none';
  return 'partial';
}

/**
 * Close every open batch and persist each as one {@link RequestLogEntry}.
 * Called by the scheduler exactly when it transitions to fully idle.
 */
export async function flushAllPending(): Promise<void> {
  if (pending.size === 0) return;

  const batches = Array.from(pending.values());
  pending.clear();

  const entries: RequestLogEntry[] = batches.map((batch) => ({
    id: generateEntryId(),
    timestamp: batch.firstTimestamp,
    reason: batch.reason,
    requestCount: batch.requestCount,
    endpoints: Array.from(batch.endpoints.values()),
    endpointsTruncated: batch.distinctEndpointCount > batch.endpoints.size,
    durationMs: Math.max(0, batch.lastSettledAt - batch.firstTimestamp),
    outcome: outcomeOf(batch),
  }));

  await appendEntries(entries);
}

function generateEntryId(): string {
  return `req_log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

async function appendEntries(newEntries: RequestLogEntry[]): Promise<void> {
  const history = await getRequestLog();
  // Newest-first, oldest evicted — same ordering/cap convention as `undoManager`.
  history.entries = [...newEntries.reverse(), ...history.entries].slice(0, history.maxSize);
  try {
    await chrome.storage.local.set({ [REQUEST_LOG_STORAGE_KEY]: history });
  } catch (error) {
    log.error('Failed to save request log:', error);
  }
}

/** Gets the current request log from chrome.storage. */
export async function getRequestLog(): Promise<RequestLogHistory> {
  try {
    const result = await chrome.storage.local.get([REQUEST_LOG_STORAGE_KEY]);
    const history = result[REQUEST_LOG_STORAGE_KEY] as RequestLogHistory | undefined;

    if (history && Array.isArray(history.entries)) {
      return history;
    }

    return { entries: [], maxSize: MAX_REQUEST_LOG_SIZE };
  } catch (error) {
    log.error('Failed to get request log:', error);
    return { entries: [], maxSize: MAX_REQUEST_LOG_SIZE };
  }
}

/** Clears the entire request log. */
export async function clearRequestLog(): Promise<void> {
  try {
    await chrome.storage.local.set({
      [REQUEST_LOG_STORAGE_KEY]: { entries: [], maxSize: MAX_REQUEST_LOG_SIZE },
    });
  } catch (error) {
    log.error('Failed to clear request log:', error);
  }
}
