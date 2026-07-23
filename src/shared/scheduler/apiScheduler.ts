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
   * @returns The {@link RequestResult} once the request settles.
   */
  async scheduleRequest(
    endpoint: string,
    method: string,
    body: unknown,
    tabId: number,
    priority: RequestPriority = 'normal',
  ): Promise<RequestResult> {
    const dedupKey = this.getGetDedupKey(method, endpoint);

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
   * strings stay distinct.
   */
  private getGetDedupKey(method: string, endpoint: string): string | null {
    return method.toUpperCase() === 'GET' ? `GET ${endpoint}` : null;
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

    // Process queue every 50ms for snappier throughput
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 50);

    log.debug('Started processing loop');
  }

  /**
   * Stop the processing loop
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    log.debug('Stopped processing loop');
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    // Skip if paused
    if (this.isPaused) {
      this.updateStatus('paused');
      return;
    }

    // An `interactive` request at the head of the (priority-ordered) queue may
    // jump the soft rate-limit gates — but only while there is genuine hard
    // headroom left, so it can never force a 429. See {@link RequestPriority}.
    const interactiveBypass =
      this.queue[0]?.priority === 'interactive' &&
      !this.rateLimitDetector.isLimitExceeded(this.activeRequests.size + 1);

    // Check cooldown
    if (this.cooldownEndsAt && Date.now() < this.cooldownEndsAt) {
      if (!interactiveBypass) {
        this.updateStatus('cooldown');
        return;
      }
      // Fall through to dispatch the interactive request; the cooldown stays
      // armed for every other tier (we do not clear `cooldownEndsAt`).
    } else if (this.cooldownEndsAt) {
      // Cooldown ended
      log.debug('Cooldown ended, resuming processing');
      this.cooldownEndsAt = null;
    }

    // Check if we can process more requests
    if (this.activeRequests.size >= this.config.maxConcurrent) {
      this.updateStatus('processing');
      return;
    }

    // Check rate limits — count the request we are about to dispatch so the
    // threshold reflects the state *after* dispatch, not before.
    if (
      this.rateLimitDetector.isApproachingLimit(
        this.config.minRemainingThreshold,
        this.activeRequests.size + 1,
      )
    ) {
      // An interactive request with hard headroom dispatches without arming a
      // cooldown; any other tier trips the soft threshold and cools down.
      if (!interactiveBypass) {
        this.enterCooldown();
        return;
      }
    }

    // Get next request from queue
    const request = this.queue.shift();
    if (!request) {
      this.updateStatus('idle');
      return;
    }

    // Execute request
    this.updateStatus('processing');
    this.executeRequest(request);
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
      }
    } finally {
      this.notifyStateChange();
    }
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
    // The completing request is still in activeRequests at this point but its
    // cost is already reflected in the server's `remaining`, so subtract 1 to
    // avoid double-counting it.
    const otherInFlight = Math.max(0, this.activeRequests.size - 1);
    const effectiveRemaining = Math.max(0, info.remaining - otherInFlight);
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
    // Wait at least until the window resets so we don't re-enter cooldown in a
    // tight loop when the configured duration is shorter than the remaining window.
    const cooldownDuration =
      resetWaitTime > 0
        ? Math.max(this.config.cooldownDuration, resetWaitTime)
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
