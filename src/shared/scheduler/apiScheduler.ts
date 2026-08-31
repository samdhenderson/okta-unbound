/**
 * @module shared/scheduler/apiScheduler
 * @description Centralized scheduler for all Okta API requests.
 *
 * Runs in the background service worker and coordinates every Okta API call in the
 * extension to prevent rate limiting. It:
 * - Queues requests by priority (high &gt; normal &gt; low)
 * - Bounds concurrency and dispatches each request to the content script
 * - Parses rate-limit headers and enters cooldown near the limit, **per Okta
 *   rate-limit bucket** — an exhausted `/api/v1/apps` bucket stops app traffic
 *   without stopping a group lookup that has its own budget
 * - Auto-retries failures with exponential backoff
 * - Tracks metrics and broadcasts state to subscribers
 *
 * @see {@link RateLimitDetector}
 */

import { createLogger } from '../utils/logger';
import { flushAllPending, recordRequest } from '../requestLog';
import { OperationCancelledError } from './cancellation';
import { RateLimitDetector, bucketOf } from './rateLimitDetector';
import { normalizeRequestResult } from './requestResult';
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
 * Key for the gate that is not any one bucket's: the most-restrictive
 * observation seen anywhere, which governs a request whose own bucket Okta has
 * not reported on yet. Not a valid Okta path, so it can never collide with a
 * real bucket key from `bucketOf`.
 */
const GLOBAL_GATE = '*';

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
  /**
   * When each armed gate lifts, keyed by rate-limit bucket, plus
   * {@link GLOBAL_GATE} for the most-restrictive-anywhere backstop.
   *
   * A gate is per-bucket because Okta's quotas are: exhausting `/api/v1/apps`
   * says nothing about `/api/v1/groups`, and stalling the whole queue on it
   * spent wall-clock the org was never asking for. The global entry survives
   * alongside them for requests whose own bucket Okta has not reported on yet —
   * see {@link gateKeyFor} — which is what keeps this from ever being *less*
   * protective than the single cooldown it replaced.
   */
  private cooldowns: Map<string, number> = new Map();
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
   * Is a gate armed right now? Expired entries are dropped as they are found,
   * so this doubles as the cooldown reaper.
   *
   * @param key - A bucket key, or {@link GLOBAL_GATE}.
   */
  private isGated(key: string): boolean {
    const endsAt = this.cooldowns.get(key);
    if (endsAt === undefined) return false;
    if (Date.now() >= endsAt) {
      this.cooldowns.delete(key);
      log.debug('Cooldown ended, resuming processing', { gate: key });
      return false;
    }
    return true;
  }

  /** Whether any gate at all is armed (drops expired entries on the way). */
  private anyGateArmed(): boolean {
    let armed = false;
    for (const key of [...this.cooldowns.keys()]) {
      if (this.isGated(key)) armed = true;
    }
    return armed;
  }

  /**
   * Which gate governs this request, and whether Okta has actually reported on
   * the bucket it belongs to.
   *
   * **A bucket Okta has spoken about answers for itself.** That is the whole
   * point: `/api/v1/apps` running out says nothing about `/api/v1/groups`, and
   * gating groups on it spent wall-clock the org was never asking for.
   *
   * **A bucket Okta has said nothing about falls back to the most-restrictive
   * observation anywhere.** Not because that is the real constraint — it isn't —
   * but because an unobserved family has no budget of its own to plead, and the
   * conservative reading is the only honest one available. This is also what
   * keeps the change from ever being weaker than the single cooldown it
   * replaced: before the first response from a family, it behaves exactly as
   * before.
   *
   * @param request - The candidate request.
   */
  private gateKeyFor(request: QueuedRequest): { key: string; observed: boolean } {
    const bucket = bucketOf(request.endpoint);
    const observed = this.rateLimitDetector.getForBucket(bucket) !== null;
    return { key: observed ? bucket : GLOBAL_GATE, observed };
  }

  /**
   * May this request dispatch right now?
   *
   * An `interactive` request may jump the soft gate — but only while the budget
   * governing it has genuine hard headroom left, so it can never force a 429
   * (see {@link RequestPriority}).
   *
   * @param request - A queued candidate.
   * @returns `'go'` to dispatch, `'gated'` to skip it and try the next queued
   * request, or `'cooldown'` when the soft threshold has just been crossed and
   * the caller must arm this request's gate.
   */
  private gateFor(request: QueuedRequest): 'go' | 'gated' | 'cooldown' {
    const { key, observed } = this.gateKeyFor(request);
    const bucket = observed ? key : undefined;

    if (request.priority === 'interactive' && !this.rateLimitDetector.isLimitExceeded(bucket)) {
      return 'go';
    }

    // An armed gate stays armed — a request that finds one simply waits, and a
    // request governed by a different gate gets its turn instead.
    if (this.isGated(key)) return 'gated';

    // In-flight requests have spent budget no header has counted yet, so they
    // are subtracted from `remaining` before the comparison. They are charged
    // in full to whichever budget governs this request: we do not track which
    // bucket each in-flight request belongs to, and over-charging errs toward
    // backing off early, which is the safe direction.
    if (
      this.rateLimitDetector.isApproachingLimit(
        this.config.minRemainingThreshold,
        this.activeRequests.size,
        bucket,
      )
    ) {
      return 'cooldown';
    }

    return 'go';
  }

  /**
   * One drain pass: dispatch queued requests until the concurrency cap, an
   * empty queue, or every remaining request being gated stops it. Every gate is
   * re-evaluated per dispatch so a multi-dispatch drain can never overshoot
   * what the single-dispatch tick would have allowed.
   *
   * Unlike the single-gate version this replaces, a gated request at the head
   * does **not** end the pass. The queue is scanned in its existing priority
   * order and the first dispatchable request wins, so a cooling-down
   * `/api/v1/apps` fan-out no longer holds up a `/api/v1/groups` lookup that has
   * its own untouched budget. Priority order is otherwise unchanged: a request
   * is only skipped when its own bucket says no.
   */
  private drainQueue(): void {
    // Skip if paused
    if (this.isPaused) {
      this.updateStatus('paused');
      return;
    }

    while (this.activeRequests.size < this.config.maxConcurrent && this.queue.length > 0) {
      let index = -1;
      for (let i = 0; i < this.queue.length; i++) {
        const verdict = this.gateFor(this.queue[i]);
        if (verdict === 'go') {
          index = i;
          break;
        }
        // Crossing the soft threshold arms this request's gate; the request is
        // then left queued and the scan continues into other buckets.
        if (verdict === 'cooldown') this.enterCooldown(this.gateKeyFor(this.queue[i]).key);
      }

      // Nothing in the queue may run yet. Everything left is waiting on a gate.
      if (index === -1) {
        this.updateStatus('cooldown');
        return;
      }

      const [request] = this.queue.splice(index, 1);

      // Execute request (synchronously registers itself in activeRequests, so
      // the loop condition above stays accurate for the next iteration).
      this.updateStatus('processing');
      this.executeRequest(request);
    }

    // Post-drain status: busy while anything is queued or in flight, cooldown
    // while a gate is armed with an empty queue, idle otherwise.
    if (this.queue.length > 0 || this.activeRequests.size > 0) {
      this.updateStatus('processing');
    } else if (this.anyGateArmed()) {
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

        // Check if we should enter cooldown after this request. The gate is the
        // bucket this response actually reported on — cooling down every other
        // family because one of them ran low is what made an apps fan-out stall
        // an unrelated interactive lookup.
        if (rateLimitInfo && this.shouldEnterCooldown(rateLimitInfo)) {
          this.enterCooldown(rateLimitInfo.bucket);
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
          // The message payload is untyped `any`. Normalizing here is what makes
          // `RequestFailure.status` true at runtime and not just in the type:
          // some producers on the content-script side (e.g. the router's
          // "Missing endpoint" rejection) reply with no status at all.
          resolve(normalizeRequestResult(response));
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
   * Arm one gate.
   *
   * @param gate - The rate-limit bucket to hold back, or {@link GLOBAL_GATE} to
   * hold everything back. A bucket with a live observation is timed by **its**
   * reset; anything else falls back to the most restrictive observation
   * anywhere, and to the configured duration when there is none.
   * @remarks The wait is `min(configured, msUntilReset)` — capped so a bad clock
   * or a far-future reset cannot stall the queue indefinitely, and never longer
   * than Okta says is necessary. Re-arming a gate that is already armed extends
   * it only if the new end is later, so a burst of settling requests cannot
   * ratchet the wait down below what the first one established.
   */
  private enterCooldown(gate: string = GLOBAL_GATE): void {
    const info =
      (gate === GLOBAL_GATE ? null : this.rateLimitDetector.getForBucket(gate)) ??
      this.rateLimitDetector.getMostRestrictive();

    // Use reset time if available and shorter, otherwise fall back to configured cooldown
    const resetWaitTime = info ? this.rateLimitDetector.getMillisecondsUntilReset(info) : 0;
    const cooldownDuration =
      resetWaitTime > 0
        ? Math.min(this.config.cooldownDuration, resetWaitTime)
        : this.config.cooldownDuration;

    const endsAt = Date.now() + cooldownDuration;
    const existing = this.cooldowns.get(gate);
    if (existing !== undefined && existing >= endsAt) return;
    this.cooldowns.set(gate, endsAt);
    this.metrics.cooldownEvents++;

    log.warn('Entering cooldown mode:', {
      gate,
      remaining: info?.remaining,
      limit: info?.limit,
      cooldownDuration: `${Math.ceil(cooldownDuration / 1000)}s`,
      endsAt: new Date(endsAt).toISOString(),
    });

    this.updateStatus('cooldown');
    this.notifyStateChange();
  }

  /**
   * Set the percentage-remaining at or below which a bucket cools down.
   *
   * Exists so the background can hand the scheduler the org's **own** answer —
   * `GET /api/v1/rate-limit-settings/warning-threshold` less a margin, see
   * `shared/scheduler/rateLimitSettings` — instead of leaving it on the
   * configured guess. Called at most once per org per browser session, and never
   * called at all when the org does not answer, in which case
   * `DEFAULT_CONFIG.minRemainingThreshold` stands.
   *
   * Takes effect on the next gate evaluation; already-armed gates are left
   * alone, since they were armed on evidence that has not changed.
   *
   * @param percent - Percentage remaining, `0`–`100`. Values outside that range
   * are ignored: a threshold above 100 would hold every request forever and a
   * negative one would disable the gate, and neither is a state a caller can
   * have meant.
   */
  setMinRemainingThreshold(percent: number): void {
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      log.warn('Ignoring out-of-range cooldown threshold', { percent });
      return;
    }
    if (this.config.minRemainingThreshold === percent) return;
    log.info('Cooldown threshold updated', {
      from: this.config.minRemainingThreshold,
      to: percent,
    });
    this.config.minRemainingThreshold = percent;
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
   * When the last armed gate lifts, or `null` when none is.
   *
   * The **latest** end across every gate, not the earliest: `SchedulerState`'s
   * `cooldownEndsAt` drives the activity bar's countdown, and a reader watching
   * it is being told when the scheduler is unencumbered. Quoting the earliest
   * would promise a clear queue while another bucket was still held back.
   * Unchanged for the common case — one bucket cooling down reports its own end,
   * exactly as the single cooldown did.
   */
  private latestCooldownEnd(): number | null {
    let latest: number | null = null;
    for (const key of [...this.cooldowns.keys()]) {
      if (!this.isGated(key)) continue;
      const endsAt = this.cooldowns.get(key) as number;
      if (latest === null || endsAt > latest) latest = endsAt;
    }
    return latest;
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
      cooldownEndsAt: this.latestCooldownEnd(),
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
