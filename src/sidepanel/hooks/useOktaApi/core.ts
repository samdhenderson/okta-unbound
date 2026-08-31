/**
 * @module hooks/useOktaApi/core
 * @description Core primitives every operation module builds on: side-panel →
 * content-script messaging and scheduler-routed Okta API requests.
 *
 * @remarks
 * The two transport methods are deliberately different:
 * - `sendMessage` talks directly to the content script (used for messages the
 *   content script handles itself, e.g. streaming a CSV export to download).
 * - `makeApiRequest` routes through the background `ApiScheduler` so every
 *   Okta call is rate-limited and prioritized. All raw Okta API traffic MUST go
 *   through this path — never bypass it with a direct content-script fetch.
 */

import type { MessageRequest, MessageResponse, OperationCallbacks } from './types';
import type { RequestResult, RequestPriority } from '@/shared/scheduler/types';
import { runBatch, type BatchProgress, type BatchOutcome } from '@/shared/scheduler/runBatch';
import type { PlanEstimate, PlanLegInput } from '@/shared/scheduler/plan';
import { fanOutEstimate, atLeastFanOutEstimate } from '@/shared/scheduler/planEstimate';
import type { OperationPlanUpdate } from '@/shared/types';
import { createLogger } from '@/shared/utils/logger';
import { z } from 'zod';
import {
  getCachedCurrentUser,
  cacheCurrentUser,
  type Actor,
  type ResolvedActor,
} from './currentUserCache';

export type { Actor } from './currentUserCache';

const log = createLogger('useOktaApi');

/**
 * Substrings Chrome uses when a `runtime.sendMessage` loses the port because the
 * MV3 service worker was suspending / still waking up. Matched case-insensitively.
 */
const TRANSIENT_PORT_ERROR_PATTERNS = [
  'message port closed before a response',
  'receiving end does not exist',
];

/**
 * The slice of `GET /api/v1/users/me` audit attribution needs.
 *
 * Deliberately lenient (`passthrough`, everything optional): the only field
 * that decides anything is `profile.email`, and its absence is a valid answer
 * (`reason: 'no-email'`) rather than an error — so this schema classifies the
 * response instead of rejecting it.
 */
const currentUserSchema = z
  .object({
    id: z.string().optional(),
    profile: z.object({ email: z.string().optional() }).passthrough().optional(),
  })
  .passthrough();

/** Retries allowed after a transient port failure (GET only). */
const TRANSIENT_PORT_MAX_RETRIES = 2;

/** Backoff before retry attempt N (0-indexed): ~250ms, then ~500ms. */
const TRANSIENT_PORT_RETRY_DELAYS_MS = [250, 500];

/**
 * Is `message` one of the transient MV3 service-worker wakeup failures that a
 * plain re-send can recover from?
 *
 * @param message - The rejection message from `chrome.runtime.sendMessage`.
 * @returns `true` for a dropped/not-yet-live message port, `false` otherwise.
 * @remarks Deliberately does NOT match `Extension context invalidated` — that
 * means the extension was reloaded underneath the panel, which no retry can fix;
 * it must surface to the caller so the UI can tell the user to reopen the panel.
 */
export function isTransientPortError(message: string): boolean {
  const normalized = message.toLowerCase();
  return TRANSIENT_PORT_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
}

/**
 * Global progress lifecycle hooks the operation runner drives. Supplied by
 * `useOktaApi` from `ProgressContext` (or no-ops outside a provider).
 */
export interface ProgressBridge {
  /** Begin a named operation over `total` items. */
  start: (name: string, total: number) => void;
  /** Report live batch counts. */
  reportBatch: (progress: BatchProgress, message?: string) => void;
  /** End the operation. */
  complete: () => void;
}

/**
 * Options for {@link CoreApi.makeApiRequest}.
 *
 * `reason` is required — it is what the verbose request audit log
 * (`shared/requestLog`) shows as "why" a request was made, and every call
 * site in `useOktaApi/*` supplies one so the log has full coverage rather than
 * a partial, unlabeled tail. Inside a {@link CoreApi.runOperation} task, reuse
 * the same `name` passed to `runOperation` — it is already the operation's
 * human label.
 */
export interface MakeApiRequestOptions {
  method?: string;
  body?: unknown;
  priority?: RequestPriority;
  /** Human-readable "why", e.g. `'Load group members'`. Shown in the History tab's verbose mode. */
  reason: string;
  /**
   * The {@link PlanHandle} this request belongs to, when it was issued inside a
   * {@link CoreApi.withPlan} block. Threaded explicitly rather than ambiently —
   * the browser has no `AsyncLocalStorage`, and `reason` is already threaded the
   * same way.
   */
  planId?: string;
}

/** Options for {@link CoreApi.runOperation}. */
export interface RunOperationOptions<T> {
  /** Max concurrent tasks; defaults to the scheduler cap (5). */
  concurrency?: number;
  /** Return `true` from a settled error to stop launching further work (e.g. a 403 wall). */
  stopOnError?: (error: unknown, item: T, index: number) => boolean;
  /** Derive the status message shown in the activity bar from the live counts. */
  message?: (progress: BatchProgress) => string;
  /**
   * Declare this operation's request budget so the activity bar can show what
   * the fan-out will cost before it is spent (ADR-0060).
   *
   * Supply the endpoint each item will hit — its bucket is what the plan is
   * keyed by — and, when an item costs more than one request, how many. The
   * per-item worker receives the resulting `planId` and must pass it in its
   * {@link MakeApiRequestOptions}, or the requests will run unattributed.
   */
  plan?: {
    endpoint: string;
    method?: string;
    requestsPerItem?: number;
    /**
     * Set when an item costs *at least* `requestsPerItem` rather than exactly
     * that — an item whose worker paginates, for instance. The declared total
     * becomes a floor the bar renders as approximate instead of a number it
     * presents as fact.
     */
    approximate?: boolean;
  };
}

/**
 * Shared transport surface passed into every operation factory.
 *
 * @remarks
 * Bundles the target tab, the two message transports, cancellation check, and
 * progress/result callbacks so the operation modules stay free of Chrome-runtime
 * plumbing.
 */
export interface CoreApi {
  /** Content-script tab currently connected to an Okta session, or `null` when disconnected. */
  targetTabId: number | null;
  /** Send a message straight to the content script (bypasses the scheduler; not for Okta API calls). */
  sendMessage: <T = unknown>(message: MessageRequest) => Promise<MessageResponse<T>>;
  /**
   * Enqueue an Okta API request via the background scheduler; `options.priority`
   * orders it against other in-flight work, and `options.reason` is required —
   * see {@link MakeApiRequestOptions}.
   */
  makeApiRequest: (endpoint: string, options: MakeApiRequestOptions) => Promise<RequestResult>;
  /**
   * Resolve the signed-in admin (for audit attribution) as a discriminated
   * {@link Actor}: either `kind: 'resolved'` with a real email/id, or
   * `kind: 'unavailable'` with the reason it could not be determined. There is
   * no placeholder identity — callers must branch on `kind`.
   */
  getCurrentUser: () => Promise<Actor>;
  /** Throws if the caller has requested cancellation; call between iterations in long loops. */
  checkCancelled: () => void;
  /** Clear any prior cancellation; call once at the start of a cancellable operation. */
  resetCancellation: () => void;
  /**
   * Run a list of Okta calls as one tracked, cancellable operation.
   *
   * Owns the global progress lifecycle (start → live counts → complete) and runs
   * the work through {@link runBatch} with bounded concurrency and the shared
   * cancellation guard, so every operation gets the full activity view and one
   * Cancel. This is the standard way to perform any multi-call read or write.
   *
   * @param name - Operation label shown in the activity bar.
   * @param items - Work items.
   * @param task - Per-item worker; issues its own scheduler request(s). Receives
   * the declared `planId` as a third argument when `options.plan` is set, and
   * must pass it through in its {@link MakeApiRequestOptions}.
   * @param options - See {@link RunOperationOptions}.
   * @returns The {@link BatchOutcome}; never throws for cancellation (inspect `cancelled`).
   */
  runOperation: <T, R>(
    name: string,
    items: T[],
    task: (item: T, index: number, planId?: string) => Promise<R>,
    options?: RunOperationOptions<T>,
  ) => Promise<BatchOutcome<T, R>>;
  /**
   * Run a walk-shaped operation that declares its request budget up front.
   *
   * The counterpart to {@link CoreApi.runOperation} for work that is not a
   * per-item fan-out — a pagination walk, an export. The callback receives a
   * {@link PlanHandle}: pass `handle.planId` in every request's
   * {@link MakeApiRequestOptions} so the requests are attributed, and call
   * `handle.refine` as pages land so the estimate rises with what is known.
   *
   * The plan is always closed, on success, failure, or cancellation. A plan that
   * outlived its operation would hold a row in the bar promising work nobody is
   * doing.
   *
   * @param name - Operation label shown in the activity bar.
   * @param legs - One entry per bucket this operation will spend against.
   * @param run - The operation itself.
   */
  withPlan: <R>(
    name: string,
    legs: PlanLegInput[],
    run: (handle: PlanHandle) => Promise<R>,
  ) => Promise<R>;
  /** Progress/result callbacks used to surface operation feedback to the UI. */
  callbacks: OperationCallbacks;
}

/** What a {@link CoreApi.withPlan} block hands to the work it wraps. */
export interface PlanHandle {
  /**
   * Pass this in every {@link MakeApiRequestOptions} inside the block. A request
   * that omits it still runs — the ledger is advisory — but is not counted
   * against the operation.
   */
  planId: string;
  /**
   * Update one leg's estimate as the operation learns more, e.g. from
   * `refinedWalkEstimate` (`shared/scheduler/planEstimate`) after each page.
   *
   * Fire-and-forget: a refinement that fails to reach the background must never
   * fail the walk it is describing.
   */
  refine: (endpoint: string, estimate: PlanEstimate) => void;
}

/**
 * Build the {@link CoreApi} transport surface for a given Okta tab.
 *
 * @param targetTabId - Content-script tab holding the live Okta session, or `null` if not connected.
 * @param checkCancelled - Cancellation guard threaded through to long-running operations.
 * @param resetCancellation - Clears a prior cancel; operations call it at their start.
 * @param progress - Global progress lifecycle bridge used by {@link CoreApi.runOperation}.
 * @param callbacks - Progress/result callbacks forwarded to operations.
 * @returns The {@link CoreApi} consumed by every `create*Operations` factory.
 * @remarks `sendMessage` and `makeApiRequest` both throw if `targetTabId` is `null`.
 */
/**
 * Mint an opaque plan id.
 *
 * Only ever compared, never parsed — `crypto.randomUUID` is available in every
 * MV3 context this runs in, and uniqueness across concurrently open panels is
 * the only property required.
 */
function newPlanId(): string {
  return `plan-${crypto.randomUUID()}`;
}

export function createCoreApi(
  targetTabId: number | null,
  checkCancelled: () => void,
  resetCancellation: () => void,
  progress: ProgressBridge,
  callbacks: OperationCallbacks,
): CoreApi {
  /**
   * Send a message to the content script and await its response.
   * @remarks Logs only the action name — never the message body, which may carry payloads/PII.
   */
  const sendMessage = async <T = unknown>(message: MessageRequest): Promise<MessageResponse<T>> => {
    if (!targetTabId) {
      throw new Error('No target tab ID - not connected to Okta page');
    }

    // Log the action only — never the message body (may contain payloads).
    log.debug('Sending message', { action: message.action });
    const response = await chrome.tabs.sendMessage(targetTabId, message);
    log.debug('Received response', { action: message.action, success: response?.success });

    return response;
  };

  /**
   * Enqueue an Okta API request through the background scheduler.
   * @remarks Routes via `chrome.runtime` `scheduleApiRequest` so the scheduler
   * enforces rate limits and honors `priority`. Only the path (query stripped)
   * is logged, never the body.
   *
   * The MV3 service worker suspends when idle, so a send that races its
   * suspension/wakeup rejects with a dropped message port. Those rejections are
   * retried up to {@link TRANSIENT_PORT_MAX_RETRIES} times (see
   * {@link isTransientPortError}) — but **only for GET**. A port error is
   * ambiguous about whether the scheduled request already executed, so a
   * non-GET (write) is never re-enqueued: a double-execute is worse than a
   * surfaced failure. Any other rejection, and the final retry's, propagates
   * unchanged so caller error UX is untouched.
   */
  const makeApiRequest = async (
    endpoint: string,
    options: MakeApiRequestOptions,
  ): Promise<RequestResult> => {
    const { method = 'GET', body, priority = 'normal', reason, planId } = options;

    if (!targetTabId) {
      throw new Error('No target tab ID - not connected to Okta page');
    }

    log.debug('Scheduling API request via background', {
      endpoint: endpoint.split('?')[0],
      method,
      priority,
    });

    // Reads are safely repeatable; writes are not (see the doc comment above).
    const retryable = method.toUpperCase() === 'GET';
    let response: RequestResult;
    let attempt = 0;

    for (;;) {
      try {
        // Route through the background scheduler for rate limit control
        response = await chrome.runtime.sendMessage({
          action: 'scheduleApiRequest',
          endpoint,
          method,
          body,
          tabId: targetTabId,
          priority,
          reason,
          planId,
        });
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!retryable || attempt >= TRANSIENT_PORT_MAX_RETRIES || !isTransientPortError(message)) {
          throw error;
        }
        // Identifiers and outcomes only — never the body or the error payload.
        log.debug('Retrying scheduled API request after transient port error', {
          endpoint: endpoint.split('?')[0],
          attempt: attempt + 1,
        });
        const delay = TRANSIENT_PORT_RETRY_DELAYS_MS[attempt];
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt += 1;
      }
    }

    log.debug('Received scheduled response', {
      endpoint: endpoint.split('?')[0],
      success: response?.success,
    });
    return response;
  };

  /**
   * Resolve the signed-in admin via `/api/v1/users/me`, for audit attribution.
   *
   * Served from a per-tab TTL cache when fresh (see `currentUserCache`) so
   * back-to-back audited operations don't re-hit the endpoint. **Only a
   * `kind: 'resolved'` actor is cached** — an unavailable actor would otherwise
   * be pinned to the tab for the whole TTL and mislabel every audited operation
   * in that window; leaving it uncached means the next call retries.
   *
   * @returns A {@link Actor}: the admin's email and id when known, otherwise
   *   `kind: 'unavailable'` with the reason. Never a placeholder identity.
   */
  const getCurrentUser = async (): Promise<Actor> => {
    if (targetTabId !== null) {
      const cached = getCachedCurrentUser(targetTabId);
      if (cached) return cached;
    }

    try {
      const response = await makeApiRequest('/api/v1/users/me', {
        reason: 'Resolve current admin identity',
      });
      if (!response.success || !response.data) {
        return { kind: 'unavailable', reason: 'failed' };
      }
      // Validate at the boundary (ADR-0006) rather than reading `any` off the
      // raw payload; anything that is not an object with a string email is
      // simply not an identity we can attribute an operation to.
      const parsed = currentUserSchema.safeParse(response.data);
      const email = parsed.success ? parsed.data.profile?.email : undefined;
      if (!parsed.success || !email) {
        // A profile with no email cannot be attributed to anyone — and must not
        // be cached, or one empty profile mislabels the whole TTL window.
        return { kind: 'unavailable', reason: 'no-email' };
      }
      // Cache the parsed identity (never the raw response). Attribution keys off
      // the email; `id` is best-effort and empty if Okta omitted it.
      const actor: ResolvedActor = { kind: 'resolved', email, id: parsed.data.id ?? '' };
      if (targetTabId !== null) {
        cacheCurrentUser(targetTabId, actor);
      }
      return actor;
    } catch (error) {
      log.error('Failed to get current user', error);
      return { kind: 'unavailable', reason: 'threw' };
    }
  };

  /**
   * Run `items` through `task` as one tracked, cancellable operation. See
   * {@link CoreApi.runOperation}.
   */
  /**
   * Post an `updateOperationPlan` message, swallowing any failure.
   *
   * The ledger is advisory (ADR-0060 §2), so a message that cannot be delivered
   * — an MV3 worker mid-suspension, most often — must degrade the display and
   * never the operation. Nothing here is awaited by a caller for that reason.
   */
  const postPlanUpdate = (message: OperationPlanUpdate): void => {
    void chrome.runtime.sendMessage({ action: 'updateOperationPlan', ...message }).catch(() => {
      log.debug('Plan update dropped', { op: message.op });
    });
  };

  const withPlan = async <R>(
    name: string,
    legs: PlanLegInput[],
    run: (handle: PlanHandle) => Promise<R>,
  ): Promise<R> => {
    const planId = newPlanId();

    if (targetTabId !== null) {
      postPlanUpdate({ op: 'declare', planId, name, tabId: targetTabId, legs });
    }

    const handle: PlanHandle = {
      planId,
      refine: (endpoint, estimate) => postPlanUpdate({ op: 'refine', planId, endpoint, estimate }),
    };

    try {
      return await run(handle);
    } finally {
      // Closed on every path. A plan that outlived its operation would hold a
      // row in the bar promising work nobody is doing.
      postPlanUpdate({ op: 'complete', planId });
    }
  };

  const runOperation = async <T, R>(
    name: string,
    items: T[],
    task: (item: T, index: number, planId?: string) => Promise<R>,
    options: RunOperationOptions<T> = {},
  ): Promise<BatchOutcome<T, R>> => {
    resetCancellation();
    progress.start(name, items.length);

    const drive = (planId?: string) =>
      runBatch(items, (item, index) => task(item, index, planId), {
        concurrency: options.concurrency,
        stopOnError: options.stopOnError,
        throwIfCancelled: checkCancelled,
        onProgress: (p) => progress.reportBatch(p, options.message?.(p)),
      });

    try {
      const plan = options.plan;
      if (!plan) return await drive();

      // A fan-out's cost is exact by construction: the item list is in hand, so
      // the request count is items × requests-per-item with nothing estimated.
      return await withPlan(
        name,
        [
          {
            endpoint: plan.endpoint,
            method: plan.method,
            estimate: plan.approximate
              ? atLeastFanOutEstimate(items.length, plan.requestsPerItem)
              : fanOutEstimate(items.length, plan.requestsPerItem),
          },
        ],
        (handle) => drive(handle.planId),
      );
    } finally {
      progress.complete();
    }
  };

  return {
    withPlan,
    targetTabId,
    sendMessage,
    makeApiRequest,
    getCurrentUser,
    checkCancelled,
    resetCancellation,
    runOperation,
    callbacks,
  };
}
