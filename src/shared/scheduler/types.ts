/**
 * @module shared/scheduler/types
 * @description Type definitions for the centralized API scheduling system.
 *
 * Shapes shared across `ApiScheduler`
 * and `RateLimitDetector`: queued
 * requests, rate-limit info, scheduler config/state/metrics, and results.
 */

import type { PlanSummary } from './plan';

/**
 * Queue priority for a scheduled request. Ordered
 * `interactive` &gt; `high` &gt; `normal` &gt; `low`.
 *
 * `interactive` is reserved for latency-sensitive, user-initiated work (e.g. a
 * type-ahead search). Beyond sorting to the front of the queue, it is the only
 * tier that bypasses the **soft** rate-limit gates — it dispatches during a soft
 * cooldown and past the approaching-limit threshold — so a typed search never
 * stalls up to 30s. It still respects `maxConcurrent`, `maxConcurrentPerBucket`
 * and a genuine **hard** rate-limit exhaustion (`remaining <= 0`), so it can
 * never force a 429. The per-bucket cap is deliberately not exempted: that cap
 * is the one guarantee that no Okta family is hit harder than it was before it
 * existed, and a reserved seat would put a hole in it (ADR-0070, open question).
 */
export type RequestPriority = 'interactive' | 'high' | 'normal' | 'low';
/** Coarse lifecycle status of the scheduler, surfaced to the UI. */
export type SchedulerStatus = 'idle' | 'processing' | 'throttled' | 'cooldown' | 'paused';

/**
 * Queued API request
 */
export interface QueuedRequest {
  id: string;
  endpoint: string;
  method: string;
  body?: unknown;
  priority: RequestPriority;
  tabId: number;
  timestamp: number;
  /**
   * Human-readable "why" for the verbose request audit log (`shared/requestLog`).
   * Absent falls back to a generic label there rather than being required here,
   * so a caller that forgets one still gets logged instead of silently dropped.
   */
  reason?: string;
  /**
   * The {@link PlanSummary}-bearing operation plan (`shared/scheduler/plan`)
   * this request was declared part of, when its caller declared one.
   *
   * Absent is ordinary and fully supported: the plan ledger is advisory, so an
   * undeclared request still runs and still shows up in its bucket's counts —
   * it just has no operation row of its own.
   */
  planId?: string;
  resolve: (response: RequestResult) => void;
  reject: (error: Error) => void;
  retryCount: number;
  maxRetries: number;
}

/**
 * Rate limit information from Okta response headers
 */
export interface RateLimitInfo {
  limit: number; // X-Rate-Limit-Limit
  remaining: number; // X-Rate-Limit-Remaining
  reset: number; // X-Rate-Limit-Reset (Unix timestamp in seconds)
  /** The exact endpoint whose response carried these headers. Reporting only. */
  endpoint: string;
  /**
   * The Okta rate-limit bucket {@link endpoint} belongs to, as computed by
   * `bucketOf` — this is what the observation is *keyed* by, because Okta
   * enforces its quotas per endpoint family rather than per URL.
   */
  bucket: string;
  timestamp: number;
}

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  maxConcurrent: number; // Max parallel requests
  /**
   * Max parallel requests **within a single Okta rate-limit bucket**
   * (`bucketOf`), on top of — never instead of —
   * {@link SchedulerConfig.maxConcurrent}.
   *
   * A per-bucket cap exists because a bucket is the only thing Okta actually
   * meters. Without one, a snapshot fan-out into a single family occupies every
   * seat the extension has, and a request to a family with a full, freshly
   * observed budget waits — not because Okta would refuse it, but because the
   * scheduler ran out of seats (ADR-0070 §2). A bucket at its cap yields its
   * turn: `drainQueue` skips it and dispatches another family instead of ending
   * the pass.
   *
   * Unlike the rate-limit *gate*, this keys on the endpoint's real bucket even
   * when Okta has said nothing about it. The gate asks *"is there budget?"*,
   * which an unobserved family genuinely cannot answer for itself; the cap asks
   * *"how many seats may this family hold?"*, which has nothing to do with
   * observation (ADR-0070 §3).
   *
   * `interactive` does **not** exempt a request from this cap, exactly as it
   * does not exempt one from {@link SchedulerConfig.maxConcurrent}
   * (ADR-0070 §7).
   *
   * Must satisfy `0 < maxConcurrentPerBucket < maxConcurrent` when supplied
   * explicitly: a cap at or above the global ceiling is a cap that does
   * nothing, and the config would be lying about what governs.
   */
  maxConcurrentPerBucket: number;
  minRemainingThreshold: number; // Trigger cooldown when remaining < this (percentage)
  cooldownDuration: number; // How long to pause when threshold hit (ms)
  retryDelay: number; // Base retry delay for failed requests (ms)
  maxRetries: number; // Max retry attempts per request
  requestTimeout: number; // Timeout for individual requests (ms)
}

/**
 * One Okta rate-limit bucket, as the Activity Bar sees it: how much budget is
 * left, and how much of what remains is already spoken for.
 *
 * A bucket appears here once anything has touched it — an observation parsed
 * from Okta's headers, a queued or in-flight request, an active plan's declared
 * leg, or a request that settled here recently enough to still be remembered.
 * The plan source is why a bucket can be listed with real
 * {@link BucketState.planned} work against it before a single request has been
 * sent, which is exactly what the scheduler could never say before.
 *
 * The remembered source (ADR-0070 §5) is why a row does not vanish the moment
 * its work finishes. **What is retained is the row's existence, never a
 * number**: a remembered-but-idle bucket reports true zero counts and a `null`
 * budget, so a memory can never pass for a reading.
 */
export interface BucketState {
  /** Bucket key from `bucketOf`, e.g. `/api/v1/users`. */
  bucket: string;
  /**
   * Quota size from `X-Rate-Limit-Limit`, or `null` when Okta has not reported
   * on this bucket yet.
   *
   * `null` is not zero. An unobserved bucket has an unknown budget, and the bar
   * says so rather than drawing an empty gauge that reads as exhaustion.
   */
  limit: number | null;
  /** Remaining budget, or `null` when unobserved. */
  remaining: number | null;
  /**
   * When this bucket's window resets, in **milliseconds** since the epoch, or
   * `null` when unobserved. Converted here from Okta's seconds-based header so
   * every timestamp crossing to the UI is in the same unit.
   */
  resetAt: number | null;
  /** Queued requests whose endpoint buckets here. */
  queued: number;
  /** In-flight requests whose endpoint buckets here. */
  active: number;
  /** Requests active plans still expect to spend here (`shared/scheduler/plan`). */
  planned: number;
  /**
   * When this bucket's gate lifts, or `null` when it is not gated.
   *
   * Reflects the gate that actually governs the bucket, which for a bucket Okta
   * has said nothing about is the global backstop rather than an entry of its
   * own — the same rule `gateKeyFor` applies when deciding whether to dispatch.
   */
  gatedUntil: number | null;
  /**
   * When a request last **settled** in this bucket during this worker's
   * lifetime, in milliseconds since the epoch, or `null` when none has.
   *
   * Exists so a reader can tell *at rest* from *never used* without inferring
   * it, and can say "last active 2m ago" in words rather than in a dimmed
   * colour nobody can read out (ADR-0070 §6).
   *
   * It is **not** a budget reading and must never be presented as one: a
   * remembered bucket whose window has reset reports `limit`/`remaining`/
   * `resetAt` as `null`, exactly like a bucket Okta has never spoken about.
   *
   * `null` after a service-worker restart is correct rather than lossy — the
   * activity it would describe did not survive the suspension either, so
   * nothing is persisted to make it look as though it had.
   */
  lastActiveAt: number | null;
}

/**
 * Scheduler state for UI display
 */
export interface SchedulerState {
  status: SchedulerStatus;
  queueLength: number;
  activeRequests: number;
  totalProcessed: number;
  /**
   * The most-restrictive observation seen anywhere. Kept as the one-number
   * summary the collapsed bar shows; {@link SchedulerState.buckets} is the
   * per-bucket truth behind it.
   */
  rateLimitInfo: RateLimitInfo | null;
  cooldownEndsAt: number | null; // Timestamp when cooldown ends
  errorCount: number;
  lastError: string | null;
  /**
   * Every bucket currently worth showing, most-pressured first.
   *
   * Okta enforces quotas per endpoint family, so one number was never the whole
   * story: `/api/v1/apps` can be exhausted while `/api/v1/groups` sits
   * untouched. The scheduler has gated per bucket since ADR-0059; this is that
   * same view finally reaching the UI.
   */
  buckets: BucketState[];
  /** Active operation plans (`shared/scheduler/plan`), oldest first. */
  plans: PlanSummary[];
  /**
   * The remaining-percentage at or below which the scheduler starts backing
   * off — learned from the org's own warning-threshold setting.
   *
   * Published so the bar can colour "low" at the line the scheduler actually
   * acts on. It previously hardcoded its own number, which meant the bar could
   * read "fine" while the scheduler was already cooling down.
   */
  minRemainingThresholdPercent: number;
  /**
   * Tabs whose Okta session the scheduler has watched expire (a 401), and for
   * which it is therefore holding requests rather than spending them.
   *
   * This is what carries session expiry to the panel: it rides the existing
   * `schedulerStateChanged` broadcast, so one 401 becomes **one** statement in
   * the masthead instead of a failed-request error state on every mounted
   * surface (ADR-0054, `D-007b`). Per tab because a tab is what holds a session
   * — two orgs in two tabs do not lose their sessions together.
   *
   * Empty is the normal case. Optional because a `SchedulerState` built by hand
   * (a fixture, an older background build) predates the field; absent reads the
   * same as empty — *nothing is known to have expired* — and never as "expired".
   */
  expiredSessionTabIds?: number[];
}

/**
 * A request that reached Okta and came back with a response the transport
 * considered successful (`response.ok`).
 *
 * @see {@link RequestResult}
 */
export interface RequestSuccess {
  /** Discriminant. */
  success: true;
  // Raw transport payload — the scheduler is response-shape-agnostic; the actual
  // Okta JSON is validated at the content-script zod boundary before use.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  /** Response headers (the rate-limit and `link` headers are read off these). */
  headers?: Record<string, string>;
  /** HTTP status of the successful response, when the producer supplied one. */
  status?: number;
}

/**
 * A request that did not succeed — and that can say *how* it failed.
 *
 * `status` is **not optional here**: every failure carries either the real HTTP
 * status Okta returned (401, 404, 429, 500…) or `NO_HTTP_STATUS` (`shared/scheduler/requestResult`) when the
 * request never produced an HTTP response at all (a transport throw, or a
 * boundary guard rejecting the request before it was sent). A caller that has
 * narrowed to this arm therefore always has a status to branch on, instead of
 * every failure mode reading identically at the type level.
 *
 * @see {@link RequestResult}
 */
export interface RequestFailure {
  /** Discriminant. */
  success: false;
  /**
   * HTTP status, or `NO_HTTP_STATUS` (`shared/scheduler/requestResult`) when there was no HTTP response.
   * Always present — that is the point of this arm.
   */
  status: number;
  /** Human-readable failure summary. Never a response body or PII. */
  error?: string;
  // Error payload as returned by Okta, when it parsed as JSON. Same untrusted
  // status as `RequestSuccess['data']` — validate before reading.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  /** Response headers, when the failure came with a response. */
  headers?: Record<string, string>;
}

/**
 * Request execution result: a discriminated union on `success`.
 *
 * Narrowing on `success` is the supported way to read one. `!result.success`
 * gives you a {@link RequestFailure} with a guaranteed `status`; `result.success`
 * gives you a {@link RequestSuccess}. Use
 * `isSessionExpired` (`shared/scheduler/requestResult`) rather than comparing
 * `status` to 401 by hand.
 */
export type RequestResult = RequestSuccess | RequestFailure;

/**
 * Scheduler metrics for debugging
 */
export interface SchedulerMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  retriedRequests: number;
  cacheHits: number;
  /** GET requests served by joining an identical in-flight request (de-duplicated). */
  coalescedRequests: number;
  averageWaitTime: number;
  averageExecutionTime: number;
  cooldownEvents: number;
  throttleEvents: number;
}
