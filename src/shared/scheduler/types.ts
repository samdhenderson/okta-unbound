/**
 * @module shared/scheduler/types
 * @description Type definitions for the centralized API scheduling system.
 *
 * Shapes shared across `ApiScheduler`
 * and `RateLimitDetector`: queued
 * requests, rate-limit info, scheduler config/state/metrics, and results.
 */

/**
 * Queue priority for a scheduled request. Ordered
 * `interactive` &gt; `high` &gt; `normal` &gt; `low`.
 *
 * `interactive` is reserved for latency-sensitive, user-initiated work (e.g. a
 * type-ahead search). Beyond sorting to the front of the queue, it is the only
 * tier that bypasses the **soft** rate-limit gates — it dispatches during a soft
 * cooldown and past the approaching-limit threshold — so a typed search never
 * stalls up to 30s. It still respects `maxConcurrent` and a genuine **hard**
 * rate-limit exhaustion (`remaining <= 0`), so it can never force a 429.
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
  endpoint: string;
  timestamp: number;
}

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  maxConcurrent: number; // Max parallel requests
  minRemainingThreshold: number; // Trigger cooldown when remaining < this (percentage)
  cooldownDuration: number; // How long to pause when threshold hit (ms)
  retryDelay: number; // Base retry delay for failed requests (ms)
  maxRetries: number; // Max retry attempts per request
  requestTimeout: number; // Timeout for individual requests (ms)
}

/**
 * Scheduler state for UI display
 */
export interface SchedulerState {
  status: SchedulerStatus;
  queueLength: number;
  activeRequests: number;
  totalProcessed: number;
  rateLimitInfo: RateLimitInfo | null;
  cooldownEndsAt: number | null; // Timestamp when cooldown ends
  errorCount: number;
  lastError: string | null;
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
  /** Reserved for a future response cache; no producer sets it today. */
  fromCache?: boolean;
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
