/**
 * @module shared/scheduler/rateLimitDetector
 * @description Parses and tracks Okta rate-limit headers to keep the scheduler
 * below API limits.
 *
 * Okta returns these per response:
 * - `X-Rate-Limit-Limit` — total requests allowed per window
 * - `X-Rate-Limit-Remaining` — requests remaining in the current window
 * - `X-Rate-Limit-Reset` — Unix timestamp (seconds) when the window resets
 *
 * Tracks limits **per Okta rate-limit bucket** plus a most-restrictive global
 * view, expiring entries once their reset time passes. A header set that is
 * absent or unreadable is recorded as nothing at all — see
 * {@link RateLimitDetector.parseHeaders} for why "unknown" is an absent entry
 * rather than a stored number.
 *
 * @see {@link https://developer.okta.com/docs/reference/rate-limits/ | Okta rate limits}
 * @see `ApiScheduler`
 */

import { createLogger } from '../utils/logger';
import type { RateLimitInfo } from './types';

const log = createLogger('RateLimitDetector');

/** Matches the first resource segment of an `/api/v1/{resource}` path. */
const API_V1_RESOURCE = /^\/api\/v1\/([^/]+)/;

/**
 * Parse one `X-Rate-Limit-*` value, or `null` when it is not a finite number.
 *
 * `parseInt` answers `NaN` for anything it cannot read, and `NaN` poisons every
 * comparison the scheduler makes: `NaN <= threshold` is `false`, so an
 * unreadable budget used to read as *calm* and no cooldown was taken. Returning
 * `null` forces the caller to decide explicitly rather than letting the bad
 * value flow into arithmetic. (`D-086`)
 *
 * @param value - A raw header value that has already passed the presence guard.
 * @returns The parsed integer, or `null` for "unknown".
 */
function parseCount(value: string): number | null {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The Okta rate-limit bucket an endpoint's quota belongs to.
 *
 * Okta does not enforce one org-wide number: quotas are bucketed by endpoint
 * family, so `/api/v1/apps` can be exhausted while `/api/v1/groups` still has
 * its full budget. Tracking observations per *URL* — which is what this module
 * used to do, query string and all — cannot see that, and it also grew the map
 * without bound as every distinct pagination cursor became its own key.
 *
 * The rule is the first resource segment: `/api/v1/apps/{id}/groups?limit=200`
 * and `/api/v1/apps?limit=200` both bucket to `/api/v1/apps`. That is
 * deliberately **at least as coarse as Okta's real buckets**, and the asymmetry
 * is the whole argument — merging two observations that share a bucket costs a
 * little precision, while splitting two that do not would let one family's
 * budget be spent twice over. Anything that is not an `/api/v1/{resource}` path
 * keys under its own path, so an unrecognised surface is isolated rather than
 * pooled with something it has nothing to do with.
 *
 * @param endpoint - Okta path, with or without a query string.
 * @returns The bucket key.
 */
export function bucketOf(endpoint: string): string {
  const path = endpoint.split('?')[0];
  const match = API_V1_RESOURCE.exec(path);
  return match ? `/api/v1/${match[1]}` : path;
}

/**
 * Stateful tracker of Okta rate-limit headers. Owned by an `ApiScheduler`;
 * not safe for concurrent mutation across instances.
 */
export class RateLimitDetector {
  /** Latest observation per bucket (see {@link bucketOf}), not per URL. */
  private limits: Map<string, RateLimitInfo> = new Map();
  private globalLimit: RateLimitInfo | null = null;

  /**
   * Parse rate limit headers from an Okta API response.
   *
   * **A header set that is absent, or that does not parse to finite numbers, is
   * "unknown" — and unknown is represented by recording nothing at all.** There
   * is exactly one way to say "I have no reading for this bucket" in this
   * module, and it is the absence of an entry: `getForBucket` answers `null`,
   * `isApproachingLimit`/`isLimitExceeded` decline to judge, and `ApiScheduler`
   * treats the bucket as *unobserved*, gating it on the most-restrictive
   * observation anywhere (`gateKeyFor` → `GLOBAL_GATE`). So an unreadable
   * budget reads neither as spare capacity nor as a hard zero that would stall
   * the queue on a reset time nobody can compute.
   *
   * The alternative — storing the `NaN`s — was the `D-086` bug: the entry could
   * never expire (`now >= NaN` is `false`), it could win the most-restrictive
   * comparison by default and mask a genuinely low bucket forever, and it
   * overwrote the last good observation for its own bucket. Declining to record
   * it leaves the previous, readable answer standing, which is the conservative
   * direction.
   *
   * @param headers - Lower-cased response headers from the content script.
   * @param endpoint - The Okta path the response came from; bucketed with
   * {@link bucketOf} before storage.
   * @returns The recorded observation, or `null` when the headers are missing or
   * unreadable.
   */
  parseHeaders(headers: Record<string, string>, endpoint: string): RateLimitInfo | null {
    const limit = headers['x-rate-limit-limit'];
    const remaining = headers['x-rate-limit-remaining'];
    const reset = headers['x-rate-limit-reset'];

    if (!limit || !remaining || !reset) {
      log.debug('Missing rate limit headers for', endpoint.split('?')[0]);
      return null;
    }

    const parsed = {
      limit: parseCount(limit),
      remaining: parseCount(remaining),
      reset: parseCount(reset),
    };

    if (parsed.limit === null || parsed.remaining === null || parsed.reset === null) {
      // One unreadable field invalidates the whole observation: a budget without
      // a reset can never expire, and a reset without a budget cannot be judged
      // against a threshold. Field names only — never the header values.
      log.warn('Unreadable rate limit headers; leaving the bucket unobserved:', {
        endpoint: endpoint.split('?')[0],
        fields: (Object.keys(parsed) as Array<keyof typeof parsed>).filter(
          (field) => parsed[field] === null,
        ),
      });
      return null;
    }

    const bucket = bucketOf(endpoint);
    const info: RateLimitInfo = {
      limit: parsed.limit,
      remaining: parsed.remaining,
      reset: parsed.reset,
      endpoint,
      bucket,
      timestamp: Date.now(),
    };

    // Store per-bucket and global. The newest observation for a bucket replaces
    // the previous one outright: Okta's headers describe that bucket's budget as
    // of that response, so the most recent answer is the only current one.
    this.limits.set(bucket, info);

    // Update global if this is more restrictive
    if (!this.globalLimit || info.remaining < this.globalLimit.remaining) {
      this.globalLimit = info;
    }

    log.debug('Rate limit updated:', {
      bucket,
      remaining: info.remaining,
      limit: info.limit,
      resetIn: this.getSecondsUntilReset(info),
    });

    return info;
  }

  /**
   * Get the most restrictive rate limit info (lowest remaining)
   */
  getMostRestrictive(): RateLimitInfo | null {
    // Clean up expired entries first
    this.cleanExpiredLimits();
    return this.globalLimit;
  }

  /**
   * Get the live observation for one bucket, or `null` when there is none — or
   * when the one there has expired.
   *
   * @param bucket - A key from {@link bucketOf}, not a raw endpoint.
   */
  getForBucket(bucket: string): RateLimitInfo | null {
    const info = this.limits.get(bucket);
    if (!info) return null;

    // Check if expired
    if (this.isExpired(info)) {
      this.limits.delete(bucket);
      return null;
    }

    return info;
  }

  /**
   * Get rate limit info covering a specific endpoint — that is, its bucket's.
   *
   * @param endpoint - An Okta path; bucketed with {@link bucketOf} before lookup.
   */
  getForEndpoint(endpoint: string): RateLimitInfo | null {
    return this.getForBucket(bucketOf(endpoint));
  }

  /**
   * Check if we're approaching the rate limit.
   * Accounts for in-flight requests that have been dispatched but whose
   * response headers haven't been processed yet.
   *
   * @param thresholdPercent - Approaching means at or below this percentage
   * remaining.
   * @param inFlightCount - Requests already dispatched whose headers have not
   * come back. Subtracted from `remaining`, because they have spent budget the
   * header has not counted yet.
   * @param bucket - Ask about one bucket's budget. Omit to ask about the
   * most-restrictive bucket seen anywhere, which is the global backstop.
   */
  isApproachingLimit(
    thresholdPercent: number = 10,
    inFlightCount: number = 0,
    bucket?: string,
  ): boolean {
    const info = bucket === undefined ? this.getMostRestrictive() : this.getForBucket(bucket);
    if (!info) return false;

    const effectiveRemaining = Math.max(0, info.remaining - inFlightCount);
    const percentRemaining = (effectiveRemaining / info.limit) * 100;
    const approaching = percentRemaining <= thresholdPercent;

    if (approaching) {
      log.warn('Approaching rate limit:', {
        bucket: info.bucket,
        remaining: info.remaining,
        limit: info.limit,
        percentRemaining: percentRemaining.toFixed(1) + '%',
        resetIn: this.getSecondsUntilReset(info),
      });
    }

    return approaching;
  }

  /**
   * Check if rate limit has been exceeded.
   *
   * @param bucket - Ask about one bucket. Omit for the most-restrictive bucket
   * seen anywhere.
   */
  isLimitExceeded(bucket?: string): boolean {
    const info = bucket === undefined ? this.getMostRestrictive() : this.getForBucket(bucket);
    if (!info) return false;
    return info.remaining <= 0;
  }

  /**
   * Get seconds until the rate limit resets
   */
  getSecondsUntilReset(info?: RateLimitInfo): number {
    const limit = info || this.getMostRestrictive();
    if (!limit) return 0;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const secondsUntilReset = Math.max(0, limit.reset - nowSeconds);
    return secondsUntilReset;
  }

  /**
   * Get milliseconds until the rate limit resets
   */
  getMillisecondsUntilReset(info?: RateLimitInfo): number {
    return this.getSecondsUntilReset(info) * 1000;
  }

  /**
   * Calculate recommended wait time before next request
   */
  getRecommendedWaitTime(thresholdPercent: number = 10, inFlightCount: number = 0): number {
    if (!this.isApproachingLimit(thresholdPercent, inFlightCount)) {
      return 0;
    }

    const info = this.getMostRestrictive();
    if (!info) return 0;

    // If limit exceeded, wait until reset
    if (info.remaining <= 0) {
      return this.getMillisecondsUntilReset(info);
    }

    // If approaching limit, calculate safe wait time
    const secondsUntilReset = this.getSecondsUntilReset(info);
    const requestsRemaining = info.remaining;

    // Spread remaining requests evenly across time window
    const safeDelaySeconds = secondsUntilReset / Math.max(requestsRemaining, 1);
    const safeDelayMs = Math.ceil(safeDelaySeconds * 1000);

    // Ensure at least 1 second between requests when approaching limit
    return Math.max(safeDelayMs, 1000);
  }

  /**
   * Check if a rate limit info has expired (reset time passed)
   */
  private isExpired(info: RateLimitInfo): boolean {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return nowSeconds >= info.reset;
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanExpiredLimits(): void {
    // Clean per-bucket limits
    for (const [bucket, info] of this.limits.entries()) {
      if (this.isExpired(info)) {
        this.limits.delete(bucket);
      }
    }

    // Clear global if expired
    if (this.globalLimit && this.isExpired(this.globalLimit)) {
      this.globalLimit = null;
    }

    // Recalculate global from remaining limits
    if (this.limits.size > 0) {
      let mostRestrictive: RateLimitInfo | null = null;
      for (const info of this.limits.values()) {
        if (!mostRestrictive || info.remaining < mostRestrictive.remaining) {
          mostRestrictive = info;
        }
      }
      this.globalLimit = mostRestrictive;
    }
  }

  /**
   * Reset all tracked limits (useful for testing)
   */
  reset(): void {
    this.limits.clear();
    this.globalLimit = null;
    log.debug('Reset all rate limit tracking');
  }

  /**
   * Get current state for debugging
   */
  getState(): {
    globalLimit: RateLimitInfo | null;
    bucketLimits: Array<{ bucket: string; info: RateLimitInfo }>;
  } {
    this.cleanExpiredLimits();

    return {
      globalLimit: this.globalLimit,
      bucketLimits: Array.from(this.limits.entries()).map(([bucket, info]) => ({
        bucket,
        info,
      })),
    };
  }
}
