/**
 * @module shared/scheduler/apiScheduler
 * @description Centralized scheduler for all Okta API requests.
 *
 * Runs in the background service worker and coordinates every Okta API call in the
 * extension to prevent rate limiting. It:
 * - Queues requests by priority (high &gt; normal &gt; low)
 * - Bounds concurrency and dispatches each request to the content script
 * - Parses rate-limit headers and enters cooldown near the limit
 * - Auto-retries failures with exponential backoff
 * - Tracks metrics and broadcasts state to subscribers
 *
 * @see {@link RateLimitDetector}
 */

import { createLogger } from '../utils/logger';
import { flushAllPending, recordRequest } from '../requestLog';
import { OperationCancelledError } from './cancellation';
import { RateLimitDetector } from './rateLimitDetector';
import type {
  QueuedRequest,
  RequestPriority,
  SchedulerStatus,
  SchedulerConfig,
  SchedulerState,
  SchedulerMetrics,
  RequestResult,
  RateLimitInfo,
} from './types';

const log = createLogger('ApiScheduler');

const DEFAULT_CONFIG: SchedulerConfig = {
  maxConcurrent: 5, // Max 5 parallel requests
  minRemainingThreshold: 10, // Cooldown when <10% remaining
  cooldownDuration: 30000, // 30 seconds cooldown fallback
  retryDelay: 2000, // 2 second base retry delay
  maxRetries: 2, // Retry up to 2 times
  requestTimeout: 30000, // 30 second timeout per request
};

/**
 * Priority queue and executor for Okta API requests. One instance is created in
 * the background worker; the processing loop starts in the constructor.
 */
export class ApiScheduler {
  private queue: QueuedRequest[] = [];
  private activeRequests: Map<string, QueuedRequest> = new Map();
  // Identical in-flight/queued GETs coalesced onto one leader request. Extra
  // callers wait for the leader's result instead of issuing their own fetch.
  private coalescableGets: Map<
    string,
    {
      request: QueuedRequest;
      waiters: Array<{ resolve: (r: RequestResult) => void; reject: (e: Error) => void }>;
    }
  > = new Map();
  private rateLimitDetector: RateLimitDetector;
  private config: SchedulerConfig;
  private status: SchedulerStatus = 'idle';
  private cooldownEndsAt: number | null = null;
  private isPaused: boolean = false;
  private processingInterval: ReturnType<typeof setInterval> | null = null;
  // Re-entrancy guard for processQueue: notifyStateChange runs listeners
  // synchronously mid-drain, and a listener may call back into the scheduler.
  // A blocked call marks `reprocessRequested` so the running drain loops again
  // instead of double-dispatching (or silently dropping the wake-up).
  private isProcessing: boolean = false;
  private reprocessRequested: boolean = false;
  // Bumped by clearQueue() (a user Cancel). A request sleeping in retry backoff
  // captures this before it waits and, on waking, rejects instead of reviving if
  // the value moved — so Cancel also stops mid-backoff requests, not just queued ones.
  private cancelGeneration: number = 0;

  // Metrics
  private metrics: SchedulerMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    retriedRequests: 0,
    cacheHits: 0,
    coalescedRequests: 0,
    averageWaitTime: 0,
    averageExecutionTime: 0,
    cooldownEvents: 0,
    throttleEvents: 0,
  };

  private lastError: string | null = null;
  private stateListeners: Set<(state: SchedulerState) => void> = new Set();

  /**
   * @param config - Partial overrides merged over `DEFAULT_CONFIG`.
   */
  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rateLimitDetector = new RateLimitDetector();

    log.debug('Initialized with config:', this.config);

    // Start processing loop
    this.startProcessing();
  }

  /**
   * Enqueue an API request and resolve when it completes (or rejects after
   * retries are exhausted).
   *
   * @param endpoint - Okta path (may include query string).
   * @param method - HTTP method.
   * @param body - Optional request body (ignored for GET).
   * @param tabId - Tab whose content script executes the fetch.
   * @param priority - Queue priority; higher runs first.
   * @param reason - Human-readable "why", recorded to the verbose request
   * audit log ({@link recordRequest}) when the request settles. Omit only when
   * there is genuinely no caller-facing label; it falls back to a generic one.
   * @returns The {@link RequestResult} once the request settles.
   */
  async scheduleRequest(
    endpoint: string,
    method: string,
    body: unknown,
    tabId: number,
    priority: RequestPriority = 'normal',
    reason?: string,
  ): Promise<RequestResult> {
    const dedupKey = this.getGetDedupKey(method, endpoint, tabId);

    // Coalesce an identical in-flight/queued GET: attach to the leader's result
    // instead of issuing a second fetch. Reads are idempotent, so this is safe.
    if (dedupKey) {
      const existing = this.coalescableGets.get(dedupKey);
      if (existing) {
        this.metrics.coalescedRequests++;
        log.debug('Coalescing duplicate GET onto in-flight request:', {
          endpoint: endpoint.split('?')[0],
        });
        return new Promise((resolve, reject) => existing.waiters.push({ resolve, reject }));
      }
    }

    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: this.generateRequestId(),
        endpoint,
        method,
        body,
        priority,
        tabId,
        timestamp: Date.now(),
        reason,
        resolve: (result: RequestResult) => resolve(result),
        reject,
        retryCount: 0,
        maxRetries: this.config.maxRetries,
      };

      // Register this GET as the coalescing leader and fan its result out to any
      // callers that joined while it was in flight, clearing the slot on settle.
      if (dedupKey) {
        const entry: {
          request: QueuedRequest;
          waiters: Array<{ resolve: (r: RequestResult) => void; reject: (e: Error) => void }>;
        } = { request, waiters: [] };
        this.coalescableGets.set(dedupKey, entry);
        request.resolve = (result: RequestResult) => {
          this.coalescableGets.delete(dedupKey);
          resolve(result);
          entry.waiters.forEach((w) => w.resolve(result));
        };
        request.reject = (error: Error) => {
          this.coalescableGets.delete(dedupKey);
          reject(error);
          entry.waiters.forEach((w) => w.reject(error));
        };
      }

      this.addToQueue(request);
      this.metrics.totalRequests++;
      this.notifyStateChange();

      // Restart the fallback interval if the idle scheduler stopped it.
      this.startProcessing();

      // Kick the drain event-driven so a request scheduled while the scheduler
      // is idle dispatches immediately instead of waiting for the 50ms fallback
      // tick. Deferred one microtask so a synchronous burst of schedules is
      // fully enqueued (and priority-ordered) before the first dispatch.
      void Promise.resolve().then(() => this.processQueue());

      log.debug('Scheduled request:', {
        id: request.id,
        endpoint: endpoint.split('?')[0],
        method,
        priority,
        queueLength: this.queue.length,
      });
    });
  }

  /**
   * Coalescing key for an idempotent GET, or `null` for methods that must not be
   * de-duplicated (mutations). Includes the full endpoint so differing query
   * strings stay distinct, and the tabId so identical paths issued against
   * different Okta tabs (different orgs, different sessions) never share one
   * response.
   */
  private getGetDedupKey(method: string, endpoint: string, tabId: number): string | null {
    return method.toUpperCase() === 'GET' ? `GET ${tabId} ${endpoint}` : null;
  }

  /**
   * Add request to queue with priority ordering
   */
  private addToQueue(request: QueuedRequest): void {
    // Insert based on priority (interactive > high > normal > low)
    const priorityOrder = { interactive: 0, high: 1, normal: 2, low: 3 };
    const requestPriorityValue = priorityOrder[request.priority];

    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (priorityOrder[this.queue[i].priority] > requestPriorityValue) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, request);
  }

  /**
   * Start the processing loop
   */
  private startProcessing(): void {
    if (this.processingInterval) return;

    // Fallback tick: dispatch is event-driven (on schedule and on settle), but
    // the 50ms loop still catches time-based wake-ups such as a cooldown ending.
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 50);

    log.debug('Started processing loop');
  }

  /**
   * Stop the fallback interval. Called when the scheduler goes fully idle so an
   * MV3 service worker is not kept alive by an empty 50ms loop;
   * {@link scheduleRequest} restarts it.
   */
  private stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      log.debug('Stopped processing loop');
    }
  }

  /**
   * Stop the processing loop
   */
  stop(): void {
    this.stopProcessing();
  }

  /**
   * Process queued requests: drain the queue event-driven, filling every free
   * `maxConcurrent` slot in one pass. Invoked on schedule and on settle (with
   * the 50ms interval as a fallback); the re-entrancy guard makes concurrent
   * invocations loop the running drain once more instead of double-dispatching.
   */
  private processQueue(): void {
    if (this.isProcessing) {
      this.reprocessRequested = true;
      return;
    }
    this.isProcessing = true;
    try {
      do {
        this.reprocessRequested = false;
        this.drainQueue();
      } while (this.reprocessRequested);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * One drain pass: dispatch queued requests until the concurrency cap, an
   * armed rate-limit gate, or an empty queue stops it. Every gate is
   * re-evaluated per dispatch so a multi-dispatch drain can never overshoot
   * what the single-dispatch tick would have allowed.
   */
  private drainQueue(): void {
    // Skip if paused
    if (this.isPaused) {
      this.updateStatus('paused');
      return;
    }

    // Clear an expired cooldown before draining
    if (this.cooldownEndsAt && Date.now() >= this.cooldownEndsAt) {
      log.debug('Cooldown ended, resuming processing');
      this.cooldownEndsAt = null;
    }

    while (this.activeRequests.size < this.config.maxConcurrent && this.queue.length > 0) {
      // An `interactive` request at the head of the (priority-ordered) queue may
      // jump the soft rate-limit gates — but only while there is genuine hard
      // headroom left, so it can never force a 429. See {@link RequestPriority}.
      // Re-evaluated every iteration: the head changes as requests dispatch.
      const interactiveBypass =
        this.queue[0]?.priority === 'interactive' && !this.rateLimitDetector.isLimitExceeded();

      // Check cooldown (may have been armed mid-drain by a settling request).
      // An interactive head falls through to dispatch; the cooldown stays armed
      // for every other tier (we do not clear `cooldownEndsAt`).
      if (this.cooldownEndsAt && Date.now() < this.cooldownEndsAt && !interactiveBypass) {
        this.updateStatus('cooldown');
        return;
      }

      // Check rate limits (account for in-flight requests). An interactive
      // request with hard headroom dispatches without arming a cooldown; any
      // other tier trips the soft threshold and cools down.
      if (
        this.rateLimitDetector.isApproachingLimit(
          this.config.minRemainingThreshold,
          this.activeRequests.size,
        ) &&
        !interactiveBypass
      ) {
        this.enterCooldown();
        return;
      }

      const request = this.queue.shift();
      if (!request) return;

      // Execute request (synchronously registers itself in activeRequests, so
      // the loop condition above stays accurate for the next iteration).
      this.updateStatus('processing');
      this.executeRequest(request);
    }

    // Post-drain status: busy while anything is queued or in flight, cooldown
    // while the gate is armed with an empty queue, idle otherwise.
    if (this.queue.length > 0 || this.activeRequests.size > 0) {
      this.updateStatus('processing');
    } else if (this.cooldownEndsAt && Date.now() < this.cooldownEndsAt) {
      // Keep the interval ticking through an armed cooldown so its expiry (a
      // time-based wake-up with nothing to settle) is still noticed and pushed.
      this.updateStatus('cooldown');
    } else {
      this.updateStatus('idle');
      // Fully idle: nothing queued, nothing in flight, no cooldown pending —
      // stop the fallback interval so the service worker can suspend.
      // scheduleRequest restarts it. Flush any open request-log batches here,
      // at the same moment we let the worker suspend, so an in-progress batch
      // is never silently lost to suspension.
      this.stopProcessing();
      void flushAllPending();
    }
  }

  /**
   * Execute a single request
   */
  private async executeRequest(request: QueuedRequest): Promise<void> {
    this.activeRequests.set(request.id, request);
    const startTime = Date.now();

    try {
      log.debug('Executing request:', {
        id: request.id,
        endpoint: request.endpoint.split('?')[0],
        method: request.method,
        attempt: request.retryCount + 1,
      });

      // Make the actual API call via content script
      const result = await this.makeApiCall(request);

      // Parse rate limit headers if present
      if (result.headers) {
        const rateLimitInfo = this.rateLimitDetector.parseHeaders(result.headers, request.endpoint);

        // Check if we should enter cooldown after this request
        if (rateLimitInfo && this.shouldEnterCooldown(rateLimitInfo)) {
          this.enterCooldown();
        }
      }

      // Calculate execution time
      const executionTime = Date.now() - startTime;
      this.updateAverageExecutionTime(executionTime);

      // Success
      this.metrics.successfulRequests++;
      this.activeRequests.delete(request.id);
      request.resolve(result);
      this.recordSettledRequest(request, true);

      log.debug('Request completed:', {
        id: request.id,
        success: result.success,
        executionTime: `${executionTime}ms`,
      });
    } catch (error) {
      log.error('Request failed:', {
        id: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        attempt: request.retryCount + 1,
      });

      // Check if we should retry
      if (request.retryCount < request.maxRetries) {
        await this.retryRequest(request, error);
      } else {
        // Max retries exceeded
        this.metrics.failedRequests++;
        this.lastError = error instanceof Error ? error.message : 'Unknown error';
        this.activeRequests.delete(request.id);
        request.reject(error instanceof Error ? error : new Error('Request failed'));
        this.recordSettledRequest(request, false);
      }
    } finally {
      this.notifyStateChange();
      // A settled request frees a concurrency slot (or, on retry, re-queued
      // itself) — drain immediately instead of waiting for the fallback tick.
      this.processQueue();
    }
  }

  /**
   * Fold a finally-settled request (success, or final failure after retries)
   * into the verbose request audit log. Not called for a coalesced GET's
   * joined waiters (only the leader that actually hit the network), and not
   * called for a mid-flight retry — only the terminal outcome.
   */
  private recordSettledRequest(request: QueuedRequest, success: boolean): void {
    recordRequest({
      reason: request.reason,
      method: request.method,
      endpoint: request.endpoint,
      timestamp: request.timestamp,
      durationMs: Date.now() - request.timestamp,
      success,
    });
  }

  /**
   * Make the actual API call via content script
   */
  private async makeApiCall(request: QueuedRequest): Promise<RequestResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.config.requestTimeout);

      chrome.tabs
        .sendMessage(request.tabId, {
          action: 'makeApiRequest',
          endpoint: request.endpoint,
          method: request.method,
          body: request.body,
        })
        .then((response) => {
          clearTimeout(timeout);
          resolve(response);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Retry a failed request
   */
  private async retryRequest(request: QueuedRequest, _error: unknown): Promise<void> {
    request.retryCount++;
    this.metrics.retriedRequests++;

    // Calculate exponential backoff delay
    const backoffDelay = this.config.retryDelay * Math.pow(2, request.retryCount - 1);

    log.debug('Retrying request:', {
      id: request.id,
      attempt: request.retryCount + 1,
      maxRetries: request.maxRetries,
      delayMs: backoffDelay,
    });

    // Wait before retrying
    const generation = this.cancelGeneration;
    await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    this.activeRequests.delete(request.id);

    // If the queue was cleared (user Cancel) while we slept, this request must not
    // revive — reject it so the awaiting operation loop unwinds, mirroring how
    // clearQueue() rejects requests that were sitting in the queue.
    if (this.cancelGeneration !== generation) {
      request.reject(new OperationCancelledError());
      this.notifyStateChange();
      return;
    }

    // Re-add to queue with high priority
    request.priority = 'high';
    this.addToQueue(request);
  }

  /**
   * Check if we should enter cooldown based on rate limit info
   */
  private shouldEnterCooldown(info: RateLimitInfo): boolean {
    const effectiveRemaining = Math.max(0, info.remaining - this.activeRequests.size);
    const percentRemaining = (effectiveRemaining / info.limit) * 100;
    return percentRemaining <= this.config.minRemainingThreshold;
  }

  /**
   * Enter cooldown mode
   */
  private enterCooldown(): void {
    const info = this.rateLimitDetector.getMostRestrictive();
    if (!info) return;

    // Use reset time if available and shorter, otherwise fall back to configured cooldown
    const resetWaitTime = this.rateLimitDetector.getMillisecondsUntilReset(info);
    const cooldownDuration =
      resetWaitTime > 0
        ? Math.min(this.config.cooldownDuration, resetWaitTime)
        : this.config.cooldownDuration;

    this.cooldownEndsAt = Date.now() + cooldownDuration;
    this.metrics.cooldownEvents++;

    log.warn('Entering cooldown mode:', {
      remaining: info.remaining,
      limit: info.limit,
      cooldownDuration: `${Math.ceil(cooldownDuration / 1000)}s`,
      endsAt: new Date(this.cooldownEndsAt).toISOString(),
    });

    this.updateStatus('cooldown');
    this.notifyStateChange();
  }

  /**
   * Pause the scheduler
   */
  pause(): void {
    this.isPaused = true;
    this.updateStatus('paused');
    log.debug('Paused');
  }

  /**
   * Resume the scheduler
   */
  resume(): void {
    this.isPaused = false;
    log.debug('Resumed');
    // Drain immediately (and restart the fallback interval in case the
    // scheduler went fully idle while paused) instead of waiting for a tick.
    this.startProcessing();
    this.processQueue();
  }

  /**
   * Update scheduler status
   */
  private updateStatus(status: SchedulerStatus): void {
    if (this.status !== status) {
      this.status = status;
      log.debug('Status changed:', status);
      // Push every real status transition so the side panel's read-through view
      // stays authoritative without polling. Transitions to `idle`/`paused` and
      // the cooldown-end happen inside `processQueue`, which otherwise would not
      // notify; this closes that gap (SchedulerContext no longer polls). Guarded
      // by the `!==` check above, so the 50ms processing loop does not churn
      // notifications while the status is unchanged.
      this.notifyStateChange();
    }
  }

  /**
   * Get current scheduler state
   */
  getState(): SchedulerState {
    return {
      status: this.status,
      queueLength: this.queue.length,
      activeRequests: this.activeRequests.size,
      totalProcessed: this.metrics.successfulRequests + this.metrics.failedRequests,
      rateLimitInfo: this.rateLimitDetector.getMostRestrictive(),
      cooldownEndsAt: this.cooldownEndsAt,
      errorCount: this.metrics.failedRequests,
      lastError: this.lastError,
    };
  }

  /**
   * Get scheduler metrics
   */
  getMetrics(): SchedulerMetrics {
    return { ...this.metrics };
  }

  /**
   * Subscribe to scheduler state changes.
   *
   * @returns An unsubscribe function that removes the listener.
   */
  onStateChange(listener: (state: SchedulerState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyStateChange(): void {
    const state = this.getState();
    this.stateListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        log.error('Error in state listener:', error);
      }
    });
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update average execution time metric
   */
  private updateAverageExecutionTime(executionTime: number): void {
    const total = this.metrics.successfulRequests + this.metrics.failedRequests;
    const currentAvg = this.metrics.averageExecutionTime;
    this.metrics.averageExecutionTime = (currentAvg * (total - 1) + executionTime) / total;
  }

  /**
   * Get total queue depth including active requests
   */
  getQueueDepth(): number {
    return this.queue.length + this.activeRequests.size;
  }

  /**
   * Drop every queued request and reject its callers.
   *
   * @returns The number of requests dropped.
   * @remarks
   * This is the queue half of a user "Cancel". Each dropped request is **rejected**
   * with {@link OperationCancelledError} (not silently discarded) so the operation
   * loop awaiting it unwinds instead of hanging; for a coalesced GET the leader's
   * reject also fans the error out to every joined waiter and clears the coalescing
   * slot. In-flight requests already dispatched to the content script are left to
   * settle; a request sleeping in retry backoff is caught by the
   * {@link cancelGeneration} bump and rejects on wake instead of reviving.
   * Cancelled requests are not retried and are not counted as failures.
   */
  clearQueue(): number {
    // Signal any request currently sleeping in retry backoff to reject on wake.
    this.cancelGeneration++;

    const dropped = this.queue;
    this.queue = [];

    for (const request of dropped) {
      // request.reject is the coalescing-aware wrapper for GETs, so this also
      // rejects any waiters and deletes the coalescing entry.
      request.reject(new OperationCancelledError());
    }

    log.debug(`Cleared ${dropped.length} requests from queue`);
    this.notifyStateChange();
    return dropped.length;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retriedRequests: 0,
      cacheHits: 0,
      coalescedRequests: 0,
      averageWaitTime: 0,
      averageExecutionTime: 0,
      cooldownEvents: 0,
      throttleEvents: 0,
    };
    log.debug('Metrics reset');
  }
}
