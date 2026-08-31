/**
 * @module shared/scheduler/plan
 * @description The scheduler's ledger of work that has been *declared* but not
 * yet spent.
 *
 * The scheduler has always been honest about the past — `queueLength` and
 * `activeRequests` describe requests that already exist — and blind to the
 * future. A walk that will cost fifty pages is indistinguishable from one that
 * will cost one until the fiftieth page lands, so the Activity Bar could only
 * ever report what had already happened.
 *
 * An {@link OperationPlan} closes that gap. A caller about to spend a lot of
 * budget declares its {@link PlanLeg}s up front — which bucket each will spend
 * against, and how many requests it expects to make — and the scheduler
 * attributes real settled requests back to those legs as they land. The
 * difference is what the bar shows as *planned*: work that is coming, priced in
 * the same units as the headroom it will consume.
 *
 * Three properties make the ledger trustworthy rather than decorative:
 *
 * - **Estimates are typed by confidence.** `exact` is a number the caller can
 *   actually derive (`items.length`, `ceil(total/200)`); `atLeast` is a walk
 *   mid-flight that will grow; `unknown` is a declared leg that cannot be sized.
 *   The bar renders all three differently, so a guess never reads as a fact.
 * - **Estimates are refined, never stale.** {@link PlanRegistry.refine} lets a
 *   pagination loop raise an `atLeast` as `Link` headers promise more pages, and
 *   settle it to `exact` when the walk ends.
 * - **The ledger is advisory.** Nothing here gates a request. An undeclared
 *   request still runs and still appears in its bucket's queued/active counts;
 *   it simply has no operation row. That is deliberate — a wrong estimate must
 *   degrade the display, never break a feature.
 *
 * @see `ApiScheduler` — owns the single registry instance and feeds it on settle.
 */

import { createLogger } from '../utils/logger';

const log = createLogger('PlanRegistry');

/**
 * How many requests a leg expects to make, and how much that number can be
 * trusted.
 *
 * The three arms are not interchangeable: a caller that knows `items.length`
 * should say `exact`, a caller walking pages should say `atLeast` and refine,
 * and a caller that genuinely cannot size the work should say `unknown` rather
 * than inventing a number. The bar treats `unknown` as "some, unquantified" and
 * never folds it into a total.
 */
export type PlanEstimate =
  { kind: 'exact'; requests: number } | { kind: 'atLeast'; requests: number } | { kind: 'unknown' };

/** One bucket's worth of a plan: the requests an operation will spend there. */
export interface PlanLeg {
  /** Unique within the owning plan. */
  id: string;
  /**
   * The Okta rate-limit bucket this leg spends against, as produced by
   * `bucketOf` (`shared/scheduler/rateLimitDetector`). Callers pass an endpoint
   * and let {@link PlanRegistry} bucket it, so there is one bucketing rule.
   */
  bucket: string;
  /** HTTP method, for display only — a leg of DELETEs reads differently. */
  method: string;
  /** Expected size. */
  estimate: PlanEstimate;
  /** Settled requests attributed to this leg so far. */
  spent: number;
}

/** Lifecycle of a plan. Only `active` plans are published to the UI. */
export type PlanStatus = 'active' | 'done' | 'cancelled';

/** A named unit of work and the request budget it declared. */
export interface OperationPlan {
  /** Opaque id minted by the declaring side and echoed on every request. */
  id: string;
  /**
   * Human-readable name, the same vocabulary as a request's `reason`
   * (e.g. `'Export all users'`). Never an endpoint, never an identifier.
   */
  name: string;
  /** Tab whose content script executes this plan's requests. */
  tabId: number;
  legs: PlanLeg[];
  startedAt: number;
  status: PlanStatus;
}

/** A leg flattened for display: what is left is what was planned minus what was spent. */
export interface PlanLegSummary {
  id: string;
  bucket: string;
  method: string;
  /** `null` when the estimate is `unknown` — the bar shows "?" rather than a zero. */
  estimated: number | null;
  spent: number;
  /** `max(0, estimated - spent)`, or `null` for an unknown estimate. */
  remaining: number | null;
  /** Whether {@link estimated} is a floor rather than a final number. */
  approximate: boolean;
}

/** An active plan, flattened for the Activity Bar. */
export interface PlanSummary {
  id: string;
  name: string;
  startedAt: number;
  legs: PlanLegSummary[];
  /** Σ of leg `spent`. */
  spent: number;
  /** Σ of leg `estimated`, ignoring unknown legs; `null` when every leg is unknown. */
  estimated: number | null;
  /** `max(0, estimated - spent)`, or `null` when {@link estimated} is null. */
  remaining: number | null;
  /** True when any leg is `atLeast` or `unknown`, i.e. the total is a floor. */
  approximate: boolean;
}

/**
 * How long a plan may sit `active` with no attribution before the registry
 * reaps it. A side panel that closes mid-operation never sends `complete`, and
 * without this a dead plan would hold a row in the bar until the worker
 * suspended.
 */
export const PLAN_STALE_MS = 5 * 60 * 1000;

/** Upper bound on concurrently tracked plans; a runaway declarer cannot grow the map without limit. */
export const MAX_TRACKED_PLANS = 32;

/** Upper bound on legs in one plan. */
export const MAX_LEGS_PER_PLAN = 16;

/** A leg as declared by a caller, before the registry assigns it an id. */
export interface PlanLegInput {
  /**
   * An Okta endpoint (or a bare bucket key). Bucketed with `bucketOf` by the
   * registry, so callers never have to know the bucketing rule.
   */
  endpoint: string;
  method?: string;
  estimate: PlanEstimate;
}

/** Everything needed to open a plan. */
export interface PlanDeclaration {
  id: string;
  name: string;
  tabId: number;
  legs: PlanLegInput[];
}

/** Normalize an estimate: request counts are non-negative integers or the estimate is unknown. */
function normalizeEstimate(estimate: PlanEstimate): PlanEstimate {
  if (estimate.kind === 'unknown') return estimate;
  if (!Number.isFinite(estimate.requests) || estimate.requests < 0) {
    return { kind: 'unknown' };
  }
  return { kind: estimate.kind, requests: Math.floor(estimate.requests) };
}

/**
 * The scheduler's plan ledger.
 *
 * Owned by a single `ApiScheduler`; not safe for concurrent mutation across
 * instances. Every mutator is total — an unknown plan id or leg id is a no-op
 * rather than a throw, because the declaring side is a separate process that
 * can always be one message behind (a `refine` arriving after a `cancel`, say).
 */
export class PlanRegistry {
  private plans: Map<string, OperationPlan> = new Map();
  /** Last time each plan saw any activity, for {@link reap}. */
  private touchedAt: Map<string, number> = new Map();
  private legSeq = 0;

  /**
   * @param bucketFor - Maps an endpoint to its rate-limit bucket. Injected
   * rather than imported so the registry has no opinion about Okta's bucketing
   * and stays trivially testable.
   */
  constructor(private readonly bucketFor: (endpoint: string) => string) {}

  /**
   * Open a plan. Re-declaring an existing id is a no-op, so a retried message
   * cannot reset a plan's `spent` counters.
   *
   * @returns The stored plan, or `null` when the declaration was rejected
   * (no legs, or the registry is at {@link MAX_TRACKED_PLANS}).
   */
  declare(declaration: PlanDeclaration): OperationPlan | null {
    const existing = this.plans.get(declaration.id);
    if (existing) return existing;

    this.reap();

    if (this.plans.size >= MAX_TRACKED_PLANS) {
      log.warn('Refusing to track another plan; at capacity', { tracked: this.plans.size });
      return null;
    }

    const legs = declaration.legs.slice(0, MAX_LEGS_PER_PLAN).map((input) => ({
      id: `leg-${++this.legSeq}`,
      bucket: this.bucketFor(input.endpoint),
      method: (input.method ?? 'GET').toUpperCase(),
      estimate: normalizeEstimate(input.estimate),
      spent: 0,
    }));

    if (legs.length === 0) return null;

    const plan: OperationPlan = {
      id: declaration.id,
      name: declaration.name,
      tabId: declaration.tabId,
      legs,
      startedAt: Date.now(),
      status: 'active',
    };

    this.plans.set(plan.id, plan);
    this.touchedAt.set(plan.id, plan.startedAt);
    log.debug('Plan declared', { name: plan.name, legs: legs.length });
    return plan;
  }

  /**
   * Update a leg's estimate mid-flight — how an `atLeast` grows as pages land
   * and settles to `exact` when the walk ends.
   *
   * A refinement may only be applied to a leg of an `active` plan. Which leg is
   * addressed by `bucket` rather than by id: the pagination loop doing the
   * refining knows the URL it is walking, not the id the registry minted in
   * another process.
   *
   * @param planId - Plan to refine.
   * @param endpoint - Endpoint (or bucket key) identifying the leg.
   * @param estimate - The new estimate.
   */
  refine(planId: string, endpoint: string, estimate: PlanEstimate): void {
    const plan = this.plans.get(planId);
    if (!plan || plan.status !== 'active') return;

    const bucket = this.bucketFor(endpoint);
    const leg = plan.legs.find((candidate) => candidate.bucket === bucket);
    if (!leg) return;

    leg.estimate = normalizeEstimate(estimate);
    this.touchedAt.set(planId, Date.now());
  }

  /**
   * Charge one settled request against a plan.
   *
   * Called from the scheduler's single settle path, so `spent` counts real
   * traffic and nothing else. A coalesced GET is charged once — to the leader —
   * because that is how many requests Okta actually saw.
   *
   * The leg is chosen by bucket. A request whose bucket no leg declared is
   * still charged: an extra leg is appended with an `unknown` estimate, which
   * is how an operation that under-declared shows up honestly in the bar rather
   * than silently losing requests. That append is bounded by
   * {@link MAX_LEGS_PER_PLAN}.
   *
   * @param planId - Plan the request declared itself part of.
   * @param endpoint - The endpoint that settled.
   */
  attribute(planId: string, endpoint: string): void {
    const plan = this.plans.get(planId);
    if (!plan || plan.status !== 'active') return;

    const bucket = this.bucketFor(endpoint);
    let leg = plan.legs.find((candidate) => candidate.bucket === bucket);

    if (!leg) {
      if (plan.legs.length >= MAX_LEGS_PER_PLAN) return;
      leg = {
        id: `leg-${++this.legSeq}`,
        bucket,
        method: 'GET',
        estimate: { kind: 'unknown' },
        spent: 0,
      };
      plan.legs.push(leg);
    }

    leg.spent++;
    this.touchedAt.set(planId, Date.now());
  }

  /** Close a plan normally. Unknown ids are ignored. */
  complete(planId: string): void {
    this.settle(planId, 'done');
  }

  /** Close a plan because the user cancelled it. Unknown ids are ignored. */
  cancel(planId: string): void {
    this.settle(planId, 'cancelled');
  }

  private settle(planId: string, status: PlanStatus): void {
    const plan = this.plans.get(planId);
    if (!plan) return;
    plan.status = status;
    this.plans.delete(planId);
    this.touchedAt.delete(planId);
    log.debug('Plan settled', { name: plan.name, status, spent: totalSpent(plan) });
  }

  /** Whether a plan is currently tracked and active. */
  has(planId: string): boolean {
    return this.plans.get(planId)?.status === 'active';
  }

  /**
   * Requests still expected against one bucket, summed across every active
   * plan. This is the "planned" segment the Activity Bar draws beyond the
   * queued one.
   *
   * Legs with an `unknown` estimate contribute nothing — there is no number to
   * add, and inventing one would make the segment lie.
   */
  plannedForBucket(bucket: string): number {
    let planned = 0;
    for (const plan of this.plans.values()) {
      if (plan.status !== 'active') continue;
      for (const leg of plan.legs) {
        if (leg.bucket !== bucket) continue;
        planned += remainingFor(leg) ?? 0;
      }
    }
    return planned;
  }

  /** Every bucket any active plan intends to spend against. */
  plannedBuckets(): Set<string> {
    const buckets = new Set<string>();
    for (const plan of this.plans.values()) {
      if (plan.status !== 'active') continue;
      for (const leg of plan.legs) buckets.add(leg.bucket);
    }
    return buckets;
  }

  /**
   * Active plans, flattened for the UI. Oldest first, so the bar's row order is
   * stable as plans come and go rather than reshuffling on every push.
   */
  summarize(): PlanSummary[] {
    this.reap();

    return [...this.plans.values()]
      .filter((plan) => plan.status === 'active')
      .sort((a, b) => a.startedAt - b.startedAt)
      .map((plan) => {
        const legs = plan.legs.map(summarizeLeg);
        const sized = legs.filter((leg) => leg.estimated !== null);
        const estimated = sized.length > 0 ? sized.reduce((n, leg) => n + leg.estimated!, 0) : null;
        const spent = totalSpent(plan);

        return {
          id: plan.id,
          name: plan.name,
          startedAt: plan.startedAt,
          legs,
          spent,
          estimated,
          remaining: estimated === null ? null : Math.max(0, estimated - spent),
          approximate: legs.some((leg) => leg.approximate || leg.estimated === null),
        };
      });
  }

  /**
   * Drop plans that have gone quiet for {@link PLAN_STALE_MS}.
   *
   * The side panel closing mid-operation is the ordinary case: nothing sends
   * `complete`, and without reaping the plan would hold a row in the bar for as
   * long as the service worker lived.
   */
  reap(now: number = Date.now()): void {
    for (const [planId, touched] of [...this.touchedAt.entries()]) {
      if (now - touched < PLAN_STALE_MS) continue;
      const plan = this.plans.get(planId);
      log.debug('Reaping stale plan', { name: plan?.name });
      this.plans.delete(planId);
      this.touchedAt.delete(planId);
    }
  }

  /** Forget everything. Used by the scheduler's own reset paths and by tests. */
  reset(): void {
    this.plans.clear();
    this.touchedAt.clear();
  }
}

/** Requests still expected from a leg, or `null` when it has no usable estimate. */
function remainingFor(leg: PlanLeg): number | null {
  if (leg.estimate.kind === 'unknown') return null;
  return Math.max(0, leg.estimate.requests - leg.spent);
}

function summarizeLeg(leg: PlanLeg): PlanLegSummary {
  const estimated = leg.estimate.kind === 'unknown' ? null : leg.estimate.requests;
  return {
    id: leg.id,
    bucket: leg.bucket,
    method: leg.method,
    estimated,
    spent: leg.spent,
    remaining: remainingFor(leg),
    approximate: leg.estimate.kind !== 'exact',
  };
}

function totalSpent(plan: OperationPlan): number {
  return plan.legs.reduce((n, leg) => n + leg.spent, 0);
}
