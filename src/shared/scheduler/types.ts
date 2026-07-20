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
 * Request execution result
 */
export interface RequestResult {
  success: boolean;
  // Raw transport payload — the scheduler is response-shape-agnostic; the actual
  // Okta JSON is validated at the content-script zod boundary before use.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  error?: string;
  headers?: Record<string, string>;
  status?: number;
  fromCache?: boolean;
}

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
