/**
 * Okta Rate Limit Detector
 *
 * Parses and tracks Okta rate limit headers to prevent hitting API limits.
 * Okta uses the following headers:
 * - X-Rate-Limit-Limit: Total requests allowed per window
 * - X-Rate-Limit-Remaining: Requests remaining in current window
 * - X-Rate-Limit-Reset: Unix timestamp (seconds) when window resets
 *
 * Reference: https://developer.okta.com/docs/reference/rate-limits/
 */

import type { RateLimitInfo } from './types';

export class RateLimitDetector {
  private limits: Map<string, RateLimitInfo> = new Map();
  private globalLimit: RateLimitInfo | null = null;

  /**
   * Parse rate limit headers from an Okta API response
   */
  parseHeaders(headers: Record<string, string>, endpoint: string): RateLimitInfo | null {
    const limit = headers['x-rate-limit-limit'];
    const remaining = headers['x-rate-limit-remaining'];
    const reset = headers['x-rate-limit-reset'];

    if (!limit || !remaining || !reset) {
      console.log('[RateLimitDetector] Missing rate limit headers for', endpoint);
      return null;
    }

    const info: RateLimitInfo = {
      limit: parseInt(limit, 10),
      remaining: parseInt(remaining, 10),
      reset: parseInt(reset, 10),
      endpoint,
      timestamp: Date.now(),
    };

    // Store per-endpoint and global
    this.limits.set(endpoint, info);

    // Update global if this is more restrictive
    if (!this.globalLimit || info.remaining < this.globalLimit.remaining) {
      this.globalLimit = info;
    }

    console.log('[RateLimitDetector] Rate limit updated:', {
      endpoint,
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
   * Get rate limit info for a specific endpoint
   */
  getForEndpoint(endpoint: string): RateLimitInfo | null {
    const info = this.limits.get(endpoint);
    if (!info) return null;

    // Check if expired
    if (this.isExpired(info)) {
      this.limits.delete(endpoint);
      return null;
    }

    return info;
  }

  /**
   * Check if we're approaching the rate limit
   */
  isApproachingLimit(thresholdPercent: number = 10): boolean {
    const info = this.getMostRestrictive();
    if (!info) return false;

    const percentRemaining = (info.remaining / info.limit) * 100;
    const approaching = percentRemaining <= thresholdPercent;

    if (approaching) {
      console.warn('[RateLimitDetector] Approaching rate limit:', {
        remaining: info.remaining,
        limit: info.limit,
        percentRemaining: percentRemaining.toFixed(1) + '%',
        resetIn: this.getSecondsUntilReset(info),
      });
    }

    return approaching;
  }

  /**
   * Check if rate limit has been exceeded
   */
  isLimitExceeded(): boolean {
    const info = this.getMostRestrictive();
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
  getRecommendedWaitTime(thresholdPercent: number = 10): number {
    if (!this.isApproachingLimit(thresholdPercent)) {
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
    // Clean per-endpoint limits
    for (const [endpoint, info] of this.limits.entries()) {
      if (this.isExpired(info)) {
        this.limits.delete(endpoint);
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
    console.log('[RateLimitDetector] Reset all rate limit tracking');
  }

  /**
   * Get current state for debugging
   */
  getState(): {
    globalLimit: RateLimitInfo | null;
    endpointLimits: Array<{ endpoint: string; info: RateLimitInfo }>;
  } {
    this.cleanExpiredLimits();

    return {
      globalLimit: this.globalLimit,
      endpointLimits: Array.from(this.limits.entries()).map(([endpoint, info]) => ({
        endpoint,
        info,
      })),
    };
  }
}
