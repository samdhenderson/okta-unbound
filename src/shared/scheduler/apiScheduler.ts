/**
 * @module shared/scheduler/apiScheduler
 * @description Centralized scheduler for all Okta API requests.
 *
 * Runs in the background service worker and coordinates every Okta API call in the
 * extension to prevent rate limiting. It:
 * - Queues requests by priority (high &gt; normal &gt; low)
 * - Bounds concurrency globally **and per Okta rate-limit bucket**, so one
 *   family's fan-out cannot occupy every seat the extension has, and dispatches
 *   each request to the content script
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
import { RateLimitDetector, bucketOf, percentRemaining } from './rateLimitDetector';
import { PlanRegistry, type PlanDeclaration, type PlanEstimate } from './plan';
import { isSessionExpired, normalizeRequestResult } from './requestResult';
import type {
  QueuedRequest,
  RequestPriority,
  SchedulerStatus,
  SchedulerConfig,
  SchedulerState,
  SchedulerMetrics,
  RequestFailure,
  RequestResult,
  RateLimitInfo,
  BucketState,
} from './types';

const log = createLogger('ApiScheduler');

/**
 * The global ceiling this scheduler enforced before {@link
 * SchedulerConfig.maxConcurrentPerBucket} existed, and therefore the most
 * concurrent requests one Okta bucket has ever seen from this extension.
 *
 * It exists only as the clamp for a caller who raises `maxConcurrent` without
 * saying anything about the per-bucket cap. Such a caller has not asked for a
 * cap, so imposing the default 4 would apply a number they never wrote — but
 * letting the cap follow an arbitrary ceiling upward would let a one-line config
 * edit quietly exceed every build that has ever run. Clamping here does neither.
 *
 * Not a tuning knob: raising it re-opens exactly the hazard it closes.
 */
const PRE_BUCKET_CAP_CEILING = 5;

const DEFAULT_CONFIG: SchedulerConfig = {
  // Ten total, four per bucket (ADR-0070 §2). The per-bucket number is below
  // the five that shipped before it, so no single Okta bucket — the only thing
  // Okta actually meters — can be hit harder than it was; the global number is
  // raised so a background fan-out and a user's click are not competing for the
  // same five seats. At 10, two saturated families still leave two seats for a
  // third, and a third saturated family cannot exist.
  maxConcurrent: 10,
  maxConcurrentPerBucket: 4,
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
 * How many cancelled plan ids to remember. Only has to outlast the unwinding of
 * the operations that were cancelled, which is a matter of seconds.
 */
const MAX_CANCELLED_PLANS = 64;

/**
 * How long a bucket stays listed after its last request settled (ADR-0070 §5).
 *
 * Ten minutes outlives every clock that used to make a row vanish — the ~60s
 * header expiry and the 5-minute `PLAN_STALE_MS` reap — with margin, so the
 * row's disappearance is governed by one decision instead of three accidents.
 * It also spans roughly ten Okta rate-limit windows, so a reader can watch a
 * bucket they exhausted actually recover, while being short enough that a panel
 * left open over lunch is not still listing this morning's work.
 */
const BUCKET_MEMORY_MS = 10 * 60 * 1000;

/**
 * How many settled buckets are remembered at once, least-recently-active
 * evicted first.
 *
 * The source reaches ten distinct `/api/v1/{resource}` families today, so 12
 * holds every family the extension can reach with room to spare: this is a
 * bound on the list the UI must render, not a rationing decision. It stays
 * regardless of that headroom, because `bucketOf` keys an unrecognised path
 * under itself and nothing guarantees the set of paths stays this small.
 */
const MAX_REMEMBERED_BUCKETS = 12;

/**
 * Statuses a *resolved* failure may be retried on.
 *
 * **429 only, deliberately.** `makeApiCall` resolves the content script's
 * failure object rather than throwing, so before `D-007c` a 429 took the success
 * path: counted as a success, reported to the caller as a generic failure, and
 * never routed into the one thing wired to backoff. 429 is the one status that
 * means *"the same request will work shortly"* — the session is live and Okta is
 * asking us to slow down.
 *
 * Nothing else is in here. **401** is an expired session, and retrying it is
 * only a slower way to fail (it is handled as suspension instead — ADR-0054).
 * **403** returns the same 403 forever. **5xx, including 503,** is not sanctioned
 * by ADR-0054 and would mean re-issuing a write whose fate this layer cannot
 * know, so it stays out until an ADR says otherwise; transport throws and
 * timeouts already reach {@link ApiScheduler.retryRequest} through the `catch`.
 */
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([429]);

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
  /**
   * Declared-but-unspent work (`shared/scheduler/plan`).
   *
   * Advisory by construction: nothing here gates a dispatch. It exists so the
   * Activity Bar can show the requests an operation *intends* to make alongside
   * the headroom they will consume, instead of discovering a fifty-page walk
   * one page at a time.
   */
  private plans: PlanRegistry;
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
  /**
   * Buckets that have gone quiet but are still worth listing, keyed by bucket,
   * holding only when a request last settled there (ADR-0070 §5).
   *
   * A bucket used to stop being reported the moment its queue, its plan and its
   * header observation had all gone quiet — on three unrelated clocks, so the
   * row for work the user had just watched vanished on a schedule nobody
   * designed. This is the one decision that replaces those three accidents.
   *
   * **It retains the row's existence and nothing else.** No budget number is
   * kept here, so a lapsed header reading can never be resurrected as a current
   * one; {@link buildBucketStates} reads every count and every limit from the
   * live sources exactly as before. Not persisted across a service-worker
   * suspension either: the activity it describes did not survive that, and
   * "active 30 seconds ago" after an eight-minute sleep would be a lie.
   */
  private rememberedBuckets: Map<string, { lastActiveAt: number }> = new Map();
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

  // Plans the user has cancelled, kept as a tombstone after the plan itself is
  // gone. Cancelling drops what is queued, but the loop that was feeding the
  // queue is still running and would enqueue its next request a moment later;
  // without this, "cancel this operation" would drop one batch and then watch
  // the operation carry on regardless.
  private cancelledPlans: string[] = [];

  /**
   * Tabs whose Okta session the scheduler has watched expire, each holding the
   * 401 failure that proved it (ADR-0054, `D-007b`).
   *
   * **Session state is scheduler state.** The content script sees one request at
   * a time and has no queue to pause; the panel sees only the surfaces that
   * happen to be mounted. The scheduler sees every request and is the only layer
   * that can decline to send the next one, which is the whole of why the signal
   * lives here.
   *
   * Keyed by tab because a tab is what holds a session: an admin with two orgs
   * open has not lost both because one expired. (ADR-0054 phrases this per Okta
   * *origin*; a request carries a `tabId` and not an origin, and one tab is one
   * origin's session, so the tab is the available — and equivalent — key.)
   */
  private expiredSessions: Map<number, RequestFailure> = new Map();

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
   * @throws When `maxConcurrentPerBucket` is supplied and is not strictly
   * between zero and the effective `maxConcurrent`. A per-bucket cap at or
   * above the global ceiling is a cap that does nothing, and a config that
   * declares one would be lying about what governs (ADR-0070 §2).
   */
  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // A caller that moves the ceiling and says nothing about the per-bucket cap
    // has not asked for one: the default 4 is stated relative to the default
    // ceiling of 10, and carrying it onto a caller-chosen ceiling of 1 would
    // impose a cap nobody wrote.
    //
    // Clamp rather than follow, and clamp to what has actually shipped. Letting
    // the cap track the ceiling reproduces such a caller's pre-field behaviour
    // only while the ceiling stays at or below PRE_BUCKET_CAP_CEILING; above it,
    // following would seat *more* requests against one Okta bucket than any
    // build ever has — `{ maxConcurrent: 20 }` would silently allow twenty, and
    // take ADR-0070's safety claim with it. Clamping to the old ceiling keeps
    // every existing caller (all of which pass 1 or 5) exactly non-binding while
    // making a raised ceiling widen parallelism *across* buckets only, which is
    // the entire point of the field.
    if (config.maxConcurrent !== undefined && config.maxConcurrentPerBucket === undefined) {
      this.config.maxConcurrentPerBucket = Math.min(
        PRE_BUCKET_CAP_CEILING,
        this.config.maxConcurrent,
      );
    }

    // Only an *explicit* cap is validated: the derived one is this constructor's
    // own doing and is clamped by construction, so it can never exceed either
    // bound the check below exists to defend.
    if (config.maxConcurrentPerBucket !== undefined) {
      const { maxConcurrent, maxConcurrentPerBucket } = this.config;
      if (maxConcurrentPerBucket <= 0 || maxConcurrentPerBucket >= maxConcurrent) {
        throw new Error(
          `maxConcurrentPerBucket must satisfy 0 < ${maxConcurrentPerBucket} < ${maxConcurrent}`,
        );
      }
    }
    this.rateLimitDetector = new RateLimitDetector();
    this.plans = new PlanRegistry(bucketOf);

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
    planId?: string,
  ): Promise<RequestResult> {
    // A request belonging to a cancelled operation never enters the queue. This
    // is the one place the ledger is authoritative rather than advisory: it
    // decides whether an operation is still running, not how much it may spend.
    if (planId && this.cancelledPlans.includes(planId)) {
      throw new OperationCancelledError();
    }

    // The session behind this tab is known to be gone, and something is already
    // out there finding out whether it came back. Settle against the fact we
    // have instead of spending another request discovering it again — this is
    // the "thirty failed requests" half of `D-007b`. It is settled, not
    // rejected: callers already handle a `RequestResult` failure, and this is
    // the same failure the session's own 401 produced.
    const expired = this.expiredSessions.get(tabId);
    if (expired && !this.canProbe(tabId)) {
      return this.sessionExpiredFailure(expired);
    }

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
        planId,
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
   * How many in-flight requests belong to a bucket right now.
   *
   * The scan is over at most `maxConcurrent` entries, and `activeRequests`
   * already carries each request's endpoint — this is the same filter
   * {@link buildBucketStates} performs, so it is not new bookkeeping.
   *
   * @param bucket - A bucket key from `bucketOf`.
   */
  private activeInBucket(bucket: string): number {
    let count = 0;
    for (const active of this.activeRequests.values()) {
      if (bucketOf(active.endpoint) === bucket) count++;
    }
    return count;
  }

  /**
   * May this request dispatch right now?
   *
   * An `interactive` request may jump the soft gate — but only while the budget
   * governing it has genuine hard headroom left, so it can never force a 429
   * (see {@link RequestPriority}). It does **not** jump the per-bucket
   * concurrency cap, any more than it jumps `maxConcurrent`.
   *
   * @param request - A queued candidate.
   * @returns `'go'` to dispatch, `'gated'` to skip it and try the next queued
   * request, or `'cooldown'` when the soft threshold has just been crossed and
   * the caller must arm this request's gate.
   */
  private gateFor(request: QueuedRequest): 'go' | 'gated' | 'cooldown' {
    const { key, observed } = this.gateKeyFor(request);
    const bucket = observed ? key : undefined;
    const ownBucket = bucketOf(request.endpoint);
    const inFlightHere = this.activeInBucket(ownBucket);

    // The per-bucket seat cap, keyed on the endpoint's real bucket whether or
    // not Okta has reported on it — deliberately unlike {@link gateKeyFor},
    // which pools an unobserved family under the global gate. The gate asks
    // whether there is budget, which an unobserved family cannot answer for
    // itself; this asks how many seats one family may hold, which has nothing
    // to do with observation. Pooling unobserved families under one cap would
    // be worst at exactly the wrong moment: cold start, before any headers
    // exist, when several families are fanning out at once. (ADR-0070 §3.)
    //
    // Checked ahead of the interactive bypass because it is a seat limit and
    // not a soft rate-limit gate: a bucket's cap is the one guarantee that no
    // Okta family is hit harder than before, and an exemption would hole it.
    if (inFlightHere >= this.config.maxConcurrentPerBucket) return 'gated';

    if (request.priority === 'interactive' && !this.rateLimitDetector.isLimitExceeded(bucket)) {
      return 'go';
    }

    // An armed gate stays armed — a request that finds one simply waits, and a
    // request governed by a different gate gets its turn instead.
    if (this.isGated(key)) return 'gated';

    // In-flight requests have spent budget no header has counted yet, so they
    // are subtracted from `remaining` before the comparison — charged to the
    // budget that will actually pay them. An **observed** bucket is charged its
    // own in-flight count, because we do now know which bucket each in-flight
    // request belongs to; charging it the global total would subtract ten
    // requests spread across three families from every family's remaining
    // budget and cool buckets down for traffic they never carried. The
    // **global backstop** keeps the full charge, because there the pessimism is
    // honest: an unobserved family really might be the one paying. (ADR-0070 §4.)
    const inFlightCharge = observed ? inFlightHere : this.activeRequests.size;

    if (
      this.rateLimitDetector.isApproachingLimit(
        this.config.minRemainingThreshold,
        inFlightCharge,
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
   * is only skipped when its own bucket says no — which now includes its own
   * bucket being at `maxConcurrentPerBucket`, so a saturated family yields its
   * turn to another instead of ending the pass (ADR-0070 §3).
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

      // Nothing in the queue may run yet. Before the per-bucket cap that could
      // only mean a gate, and `cooldown` was the whole answer; a request may now
      // also be waiting on a seat in its own bucket, which is ordinary progress
      // and not a back-off. So `cooldown` is reported only when a gate is
      // genuinely armed — which is every case that could reach here before —
      // and a purely seat-limited pass falls through to the status block below,
      // where a non-empty queue reads as `processing`.
      if (index === -1) {
        if (this.anyGateArmed()) {
          this.updateStatus('cooldown');
          return;
        }
        break;
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

      // What this result says about the session, before anything is decided
      // about the request itself: a 401 suspends the tab, and any success is the
      // evidence that lifts a suspension (ADR-0054, `D-007b`).
      this.observeSessionHealth(request, result);

      // A *resolved* failure Okta says to try again on. `makeApiCall` resolves
      // rather than throws, so without this branch a 429 fell through to the
      // success path below and was never routed into backoff (`D-007c`). A 401
      // is deliberately not in {@link RETRYABLE_STATUSES}: it is suspended
      // above, and retrying it is only a slower way to fail.
      if (
        !result.success &&
        RETRYABLE_STATUSES.has(result.status) &&
        request.retryCount < request.maxRetries
      ) {
        log.warn('Retryable failure; backing off:', {
          id: request.id,
          status: result.status,
          attempt: request.retryCount + 1,
        });
        await this.retryRequest(request, new Error(`HTTP ${result.status}`));
        return;
      }

      // Calculate execution time
      const executionTime = Date.now() - startTime;
      this.updateAverageExecutionTime(executionTime);

      // Settle. A resolved failure is a failure: it used to increment
      // `successfulRequests` (and be audited as a success) purely because it
      // arrived resolved rather than thrown (`D-007c`).
      if (result.success) {
        this.metrics.successfulRequests++;
      } else {
        this.metrics.failedRequests++;
        // The **status**, not `result.error`. That string is Okta's own
        // `errorSummary`, which routinely names the resource that failed
        // ("Not found: … user@example.com"), and `lastError` is broadcast to
        // the panel in `SchedulerState`. Outcomes and identifiers only.
        this.lastError = `HTTP ${result.status}`;
      }
      this.activeRequests.delete(request.id);
      request.resolve(result);
      this.recordSettledRequest(request, result.success);

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
   * Read one settled result for what it says about the tab's Okta session, and
   * suspend or resume accordingly (ADR-0054, `D-007b`).
   *
   * Only two results are evidence. A **401** — the one status
   * `isSessionExpired` (`shared/scheduler/requestResult`) recognises — means the
   * session is gone. **Any success** means it is back, and is the only thing
   * that lifts a suspension: a 403 or a 404 says nothing about credentials, and
   * clearing on one would drop the banner while nothing yet works.
   *
   * @param request - The request that just settled.
   * @param result - Its result.
   */
  private observeSessionHealth(request: QueuedRequest, result: RequestResult): void {
    if (isSessionExpired(result)) {
      this.suspendSession(request.tabId, result as RequestFailure);
    } else if (result.success) {
      this.resumeSession(request.tabId);
    }
  }

  /**
   * Stop spending the queue on a session that cannot serve it.
   *
   * Everything already queued for the tab is settled immediately with the same
   * failure, **without being sent** — the queue discovers the 401 once instead
   * of thirty times. In-flight requests are left to land: cancelling a request
   * that may already have reached Okta is worse than letting it finish,
   * especially for a write.
   *
   * Nothing is remembered for replay. A retry queue that re-issued writes after
   * a re-authentication would re-run an operation the admin may have abandoned
   * (ADR-0054 §2).
   *
   * @param tabId - The tab whose session ended.
   * @param failure - The 401 that proved it; reused verbatim as the settled
   * result for the work that never got sent.
   */
  private suspendSession(tabId: number, failure: RequestFailure): void {
    if (this.expiredSessions.has(tabId)) return;
    this.expiredSessions.set(tabId, failure);

    const stranded = this.queue.filter((queued) => queued.tabId === tabId);
    if (stranded.length > 0) {
      this.queue = this.queue.filter((queued) => queued.tabId !== tabId);
    }

    // Identifiers and outcomes only — no token, no body, no PII.
    log.warn('Okta session expired; holding requests for this tab', {
      tabId,
      dropped: stranded.length,
    });

    for (const queued of stranded) {
      // The coalescing-aware wrapper for a GET, so joined waiters are settled
      // and the coalescing slot is cleared with it.
      queued.resolve(this.sessionExpiredFailure(failure));
    }

    this.notifyStateChange();
  }

  /**
   * Lift a suspension because a request for that tab succeeded.
   *
   * This is the whole recovery path, and it clears on **evidence, never on a
   * timer** — nothing here polls a dead session. The evidence arrives because
   * one request per settled round is still allowed through as a probe (see
   * {@link canProbe}), so the admin's next action after signing back in is what
   * proves the session works.
   *
   * @param tabId - The tab that just answered successfully.
   */
  private resumeSession(tabId: number): void {
    if (!this.expiredSessions.delete(tabId)) return;
    log.info('Okta session is answering again; resuming', { tabId });
    this.notifyStateChange();
    this.startProcessing();
    this.processQueue();
  }

  /**
   * A fresh failure meaning "this never went out, because the session is gone".
   *
   * Deliberately **not** the observed 401 itself. That object carries the `data`
   * and `headers` of one particular request's 401 response, and handing it to a
   * caller that asked for a different endpoint would describe someone else's
   * request — spreading an unvalidated Okta payload (ADR-0006) across call sites
   * that never made the request it came from. The one thing worth keeping is the
   * status, taken from the observation rather than restated, so the single
   * definition of "session expired" stays `isSessionExpired`'s.
   *
   * @param observed - The 401 that proved the session had ended.
   */
  private sessionExpiredFailure(observed: RequestFailure): RequestFailure {
    return { success: false, status: observed.status, error: 'Okta session expired' };
  }

  /**
   * May a request for a suspended tab go out as the probe that would end the
   * suspension?
   *
   * At most one at a time: with nothing queued and nothing in flight for the
   * tab, the next request becomes the probe; while it is outstanding every other
   * request for that tab is settled against the known 401 instead of being sent.
   * That is what bounds a suspended session's traffic to one request per round
   * while still leaving a way back — a queue that refused *everything* could
   * never learn it had recovered, and polling for it is exactly the wasted
   * traffic ADR-0054 exists to stop.
   *
   * @param tabId - The suspended tab.
   */
  private canProbe(tabId: number): boolean {
    for (const active of this.activeRequests.values()) {
      if (active.tabId === tabId) return false;
    }
    return !this.queue.some((queued) => queued.tabId === tabId);
  }

  /**
   * Fold a finally-settled request (success, or final failure after retries)
   * into the verbose request audit log. Not called for a coalesced GET's
   * joined waiters (only the leader that actually hit the network), and not
   * called for a mid-flight retry — only the terminal outcome.
   */
  private recordSettledRequest(request: QueuedRequest, success: boolean): void {
    // Charge the plan here, in the one place a request is known to be finally
    // settled. A coalesced GET's joined waiters never reach this method, so a
    // plan's `spent` counts requests Okta actually saw rather than callers that
    // asked — the only reading that can honestly be compared against headroom.
    if (request.planId) {
      this.plans.attribute(request.planId, request.endpoint);
    }

    // Remember the bucket here for the same reason the plan is charged here:
    // this is the one place a request is known to be finally settled, so the
    // memory is written once per request Okta actually saw (ADR-0070 §5).
    this.rememberBucket(bucketOf(request.endpoint));

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
   * Should this response's bucket cool down?
   *
   * @param info - The observation just parsed off a response.
   * @remarks A quota that is not a positive number cannot be divided by, and the
   * result of trying (`Infinity`/`NaN`) compares `false` against every
   * threshold — so a zero budget used to read as spare capacity here exactly as
   * it did in the detector. `percentRemaining` (`shared/scheduler/rateLimitDetector`) is
   * the one guarded ratio both readers now share, and an unusable budget falls
   * back to the most-restrictive observation anywhere rather than to calm.
   * (`D-094`)
   */
  private shouldEnterCooldown(info: RateLimitInfo): boolean {
    const percent = percentRemaining(info, this.activeRequests.size);
    if (percent === null) {
      return this.rateLimitDetector.isApproachingLimit(
        this.config.minRemainingThreshold,
        this.activeRequests.size,
      );
    }
    return percent <= this.config.minRemainingThreshold;
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
      buckets: this.buildBucketStates(),
      plans: this.plans.summarize(),
      minRemainingThresholdPercent: this.config.minRemainingThreshold,
      expiredSessionTabIds: [...this.expiredSessions.keys()],
    };
  }

  /**
   * Whether a bucket has nothing happening in it: no queued request, nothing in
   * flight, no plan expecting to spend there, and no armed gate.
   *
   * This is the eviction guard for {@link rememberedBuckets}. Eviction may only
   * ever remove a row that already reports nothing happening — a bucket with
   * live work or an armed gate is kept whatever its age or the map's size,
   * because dropping it would delete a row the live sources are about to
   * rebuild anyway, and would hide an armed gate while it was still armed.
   *
   * @param bucket - A bucket key from `bucketOf`.
   */
  private isBucketQuiet(bucket: string): boolean {
    if (this.queue.some((request) => bucketOf(request.endpoint) === bucket)) return false;
    if (this.activeInBucket(bucket) > 0) return false;
    if (this.plans.plannedForBucket(bucket) > 0) return false;
    if (this.isGated(bucket)) return false;
    return true;
  }

  /**
   * Note that a request just settled in this bucket, and bring the memory back
   * inside both of its bounds.
   *
   * @param bucket - A bucket key from `bucketOf`.
   */
  private rememberBucket(bucket: string): void {
    // Delete-then-set so the Map's insertion order stays the recency order the
    // count-based eviction reads.
    this.rememberedBuckets.delete(bucket);
    this.rememberedBuckets.set(bucket, { lastActiveAt: Date.now() });
    this.pruneRememberedBuckets();
  }

  /**
   * Drop remembered buckets that are past {@link BUCKET_MEMORY_MS}, then — if
   * more than {@link MAX_REMEMBERED_BUCKETS} remain — the least recently active
   * ones until the count fits.
   *
   * Neither bound can evict a bucket that is not {@link isBucketQuiet}. Run on
   * every write *and* on every read, because age has to expire a row even when
   * nothing new is settling to trigger a write.
   */
  private pruneRememberedBuckets(): void {
    const now = Date.now();

    for (const [bucket, { lastActiveAt }] of [...this.rememberedBuckets]) {
      if (now - lastActiveAt >= BUCKET_MEMORY_MS && this.isBucketQuiet(bucket)) {
        this.rememberedBuckets.delete(bucket);
      }
    }

    if (this.rememberedBuckets.size <= MAX_REMEMBERED_BUCKETS) return;

    // Insertion order is recency order (see `rememberBucket`), so the oldest
    // evictable entries come first. Non-quiet buckets are skipped rather than
    // counted out, so a map full of busy buckets simply grows past the cap for
    // as long as they stay busy instead of dropping a live row.
    for (const [bucket] of [...this.rememberedBuckets]) {
      if (this.rememberedBuckets.size <= MAX_REMEMBERED_BUCKETS) break;
      if (this.isBucketQuiet(bucket)) this.rememberedBuckets.delete(bucket);
    }
  }

  /**
   * Every bucket currently worth showing, most-pressured first.
   *
   * The union of five sources, because each one can know about a bucket the
   * others do not: Okta's own observations, requests waiting in the queue,
   * requests in flight, the legs active plans have declared, and buckets
   * remembered from a recent settle. The plan source is why a bucket can appear
   * here with real `planned` work and no traffic yet.
   *
   * The remembered source (ADR-0070 §5) contributes **only a bucket key**. Every
   * number below is still read from the live sources, so a remembered-but-idle
   * bucket reports true zeros and a `null` budget: it reads exactly like a
   * bucket Okta has never spoken about, which `BucketState` already documents as
   * "unknown budget, and the bar says so rather than drawing an empty gauge that
   * reads as exhaustion". A memory must never be able to pass for a reading.
   *
   * Sorted by pressure — least headroom first, unobserved buckets last — so the
   * bar can render the top few rows and collapse the rest without having to
   * decide which ones matter. Remembered-idle buckets have no fraction to rank
   * and therefore fall where unobserved buckets already fall: last.
   */
  private buildBucketStates(): BucketState[] {
    this.pruneRememberedBuckets();

    const buckets = new Set<string>();
    for (const { bucket } of this.rateLimitDetector.getState().bucketLimits) buckets.add(bucket);
    for (const request of this.queue) buckets.add(bucketOf(request.endpoint));
    for (const request of this.activeRequests.values()) buckets.add(bucketOf(request.endpoint));
    for (const bucket of this.plans.plannedBuckets()) buckets.add(bucket);
    for (const bucket of this.rememberedBuckets.keys()) buckets.add(bucket);

    const globalGateEndsAt = this.isGated(GLOBAL_GATE)
      ? (this.cooldowns.get(GLOBAL_GATE) as number)
      : null;

    const states: BucketState[] = [...buckets].map((bucket) => {
      const info = this.rateLimitDetector.getForBucket(bucket);

      // Which gate governs this bucket is the same question `gateKeyFor` asks
      // when deciding whether to dispatch: an observed bucket answers for
      // itself, an unobserved one falls back to the global backstop. Reporting
      // anything else would show a bucket as free while the scheduler was in
      // fact refusing to dispatch it.
      const gatedUntil = info
        ? this.isGated(bucket)
          ? (this.cooldowns.get(bucket) as number)
          : null
        : globalGateEndsAt;

      return {
        bucket,
        limit: info?.limit ?? null,
        remaining: info?.remaining ?? null,
        // Okta reports the reset as Unix *seconds*; everything crossing to the
        // UI is milliseconds, so convert once here rather than at each reader.
        resetAt: info ? info.reset * 1000 : null,
        queued: this.queue.filter((request) => bucketOf(request.endpoint) === bucket).length,
        active: [...this.activeRequests.values()].filter(
          (request) => bucketOf(request.endpoint) === bucket,
        ).length,
        planned: this.plans.plannedForBucket(bucket),
        gatedUntil,
        lastActiveAt: this.rememberedBuckets.get(bucket)?.lastActiveAt ?? null,
      };
    });

    return states.sort(byPressure);
  }

  /**
   * Declare an operation's request budget. Advisory: nothing is reserved and no
   * request is gated on it.
   *
   * @param declaration - The plan and its legs.
   * @returns Whether the plan is now tracked.
   */
  declarePlan(declaration: PlanDeclaration): boolean {
    const declared = this.plans.declare(declaration) !== null;
    if (declared) this.notifyStateChange();
    return declared;
  }

  /**
   * Update one leg's estimate mid-flight — how a paginating walk raises its
   * floor as `Link` headers promise more pages, and settles to an exact count
   * when the walk ends.
   */
  refinePlan(planId: string, endpoint: string, estimate: PlanEstimate): void {
    if (!this.plans.has(planId)) return;
    this.plans.refine(planId, endpoint, estimate);
    this.notifyStateChange();
  }

  /** Close a plan normally. */
  completePlan(planId: string): void {
    if (!this.plans.has(planId)) return;
    this.plans.complete(planId);
    this.notifyStateChange();
  }

  /**
   * Cancel one operation: close its plan and drop **only** the queued requests
   * that declared themselves part of it.
   *
   * Deliberately narrower than {@link clearQueue}, which drains everything. A
   * background export and a foreground search share one queue, and stopping the
   * first should never take out the second. In-flight requests are left to
   * settle — they have already spent their budget, so killing them would cost
   * the quota without saving anything.
   *
   * @returns How many queued requests were dropped.
   */
  cancelPlan(planId: string): number {
    const dropped = this.queue.filter((request) => request.planId === planId);
    if (dropped.length > 0) {
      this.queue = this.queue.filter((request) => request.planId !== planId);
    }

    this.plans.cancel(planId);
    this.tombstone(planId);

    for (const request of dropped) {
      // `request.reject` is the coalescing-aware wrapper for GETs, so this also
      // rejects any waiters and clears the coalescing entry.
      request.reject(new OperationCancelledError());
    }

    log.debug('Cancelled plan', { dropped: dropped.length });
    this.notifyStateChange();
    return dropped.length;
  }

  /**
   * Remember a cancelled plan id so requests still coming down its loop are
   * refused rather than queued. Bounded FIFO: an id ages out long after the
   * operation that owned it has unwound, and ids are random per operation, so
   * a recycled slot cannot refuse someone else's work.
   */
  private tombstone(planId: string): void {
    if (this.cancelledPlans.includes(planId)) return;
    this.cancelledPlans.push(planId);
    if (this.cancelledPlans.length > MAX_CANCELLED_PLANS) {
      this.cancelledPlans.shift();
    }
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

    // A whole-queue drain is a user Cancel of everything, so no declared plan
    // survives it — leaving them would strand rows in the bar promising work
    // that was just thrown away. Each is tombstoned for the same reason a
    // single cancel is: the loops behind them are still running.
    for (const plan of this.plans.summarize()) this.tombstone(plan.id);
    this.plans.reset();

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

/**
 * Sort comparator: least headroom first, unobserved buckets last.
 *
 * Ranking by *fraction* rather than absolute remaining is what makes buckets
 * with different quota sizes comparable — 50 left of 100 is under more pressure
 * than 200 left of 1000, even though the second number is larger. A bucket Okta
 * has not reported on has no fraction to rank, so it sorts to the bottom (by
 * name, for a stable order) rather than being guessed at.
 */
function byPressure(a: BucketState, b: BucketState): number {
  const fractionOf = (state: BucketState): number | null =>
    state.limit && state.limit > 0 && state.remaining !== null
      ? state.remaining / state.limit
      : null;

  const left = fractionOf(a);
  const right = fractionOf(b);

  if (left === null && right === null) return a.bucket.localeCompare(b.bucket);
  if (left === null) return 1;
  if (right === null) return -1;
  if (left !== right) return left - right;
  return a.bucket.localeCompare(b.bucket);
}
