/**
 * Tests for RateLimitDetector — the scheduler's parser/tracker of Okta
 * `X-Rate-Limit-*` headers. These pin the pure header-math contract: per-endpoint
 * + most-restrictive global tracking, in-flight-aware threshold checks, and
 * reset/cooldown computation. Time is frozen with fake timers so `Date.now()`
 * reads are deterministic — no real clocks that could make branches flaky.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimitDetector } from './rateLimitDetector';

/** A fixed wall-clock instant used as "now" for every test. */
const NOW_MS = 1_700_000_000_000;
const NOW_SECONDS = Math.floor(NOW_MS / 1000);

/** Build an Okta-style header bag; omit a key by passing `undefined`. */
function headers(limit?: string, remaining?: string, reset?: string): Record<string, string> {
  const h: Record<string, string> = {};
  if (limit !== undefined) h['x-rate-limit-limit'] = limit;
  if (remaining !== undefined) h['x-rate-limit-remaining'] = remaining;
  if (reset !== undefined) h['x-rate-limit-reset'] = reset;
  return h;
}

describe('RateLimitDetector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('parseHeaders', () => {
    it('parses a complete header set and records it per-endpoint + globally', () => {
      const d = new RateLimitDetector();
      const info = d.parseHeaders(headers('100', '90', String(NOW_SECONDS + 60)), '/api/v1/groups');

      expect(info).not.toBeNull();
      expect(info).toMatchObject({
        limit: 100,
        remaining: 90,
        reset: NOW_SECONDS + 60,
        endpoint: '/api/v1/groups',
        timestamp: NOW_MS,
      });
      expect(d.getForEndpoint('/api/v1/groups')).toEqual(info);
      expect(d.getMostRestrictive()).toEqual(info);
    });

    it('returns null when the limit header is absent', () => {
      const d = new RateLimitDetector();
      expect(d.parseHeaders(headers(undefined, '90', String(NOW_SECONDS + 60)), '/x')).toBeNull();
      expect(d.getMostRestrictive()).toBeNull();
    });

    it('returns null when the remaining header is absent', () => {
      const d = new RateLimitDetector();
      expect(d.parseHeaders(headers('100', undefined, String(NOW_SECONDS + 60)), '/x')).toBeNull();
    });

    it('returns null when the reset header is absent', () => {
      const d = new RateLimitDetector();
      expect(d.parseHeaders(headers('100', '90', undefined), '/x')).toBeNull();
    });

    it('treats an empty-string header as absent (falsy guard)', () => {
      const d = new RateLimitDetector();
      // remaining='' is falsy so the whole set is rejected before parseInt.
      expect(d.parseHeaders(headers('100', '', String(NOW_SECONDS + 60)), '/x')).toBeNull();
    });

    it('yields NaN fields for malformed numeric headers but still stores them', () => {
      const d = new RateLimitDetector();
      // Non-numeric but truthy strings pass the presence guard; parseInt → NaN.
      const info = d.parseHeaders(headers('abc', 'xyz', 'nope'), '/api/v1/malformed');
      expect(info).not.toBeNull();
      expect(Number.isNaN(info!.limit)).toBe(true);
      expect(Number.isNaN(info!.remaining)).toBe(true);
      expect(Number.isNaN(info!.reset)).toBe(true);
    });

    it('tracks the most restrictive endpoint across multiple endpoints', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '80', String(NOW_SECONDS + 60)), '/a');
      d.parseHeaders(headers('100', '20', String(NOW_SECONDS + 60)), '/b');
      // A higher-remaining third endpoint must not displace the global.
      d.parseHeaders(headers('100', '95', String(NOW_SECONDS + 60)), '/c');

      expect(d.getMostRestrictive()?.endpoint).toBe('/b');
      expect(d.getMostRestrictive()?.remaining).toBe(20);
    });

    it('does not update the global when the new endpoint is equal-or-less restrictive', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '20', String(NOW_SECONDS + 60)), '/b');
      // Equal remaining: strict `<` means the global stays on /b.
      d.parseHeaders(headers('100', '20', String(NOW_SECONDS + 60)), '/d');
      expect(d.getMostRestrictive()?.endpoint).toBe('/b');
    });
  });

  describe('getForEndpoint', () => {
    it('returns null for an endpoint that was never seen', () => {
      const d = new RateLimitDetector();
      expect(d.getForEndpoint('/never')).toBeNull();
    });

    it('evicts and returns null once the endpoint entry has expired', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '90', String(NOW_SECONDS + 10)), '/soon');
      expect(d.getForEndpoint('/soon')).not.toBeNull();

      // Advance past the reset time; the entry is expired and evicted.
      vi.setSystemTime((NOW_SECONDS + 11) * 1000);
      expect(d.getForEndpoint('/soon')).toBeNull();
    });
  });

  describe('isApproachingLimit', () => {
    it('is false when no limits have been recorded', () => {
      const d = new RateLimitDetector();
      expect(d.isApproachingLimit()).toBe(false);
    });

    it('is false when remaining is comfortably above the default 10% threshold', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '50', String(NOW_SECONDS + 60)), '/a');
      expect(d.isApproachingLimit()).toBe(false);
    });

    it('is true exactly at the threshold boundary (10% remaining)', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '10', String(NOW_SECONDS + 60)), '/a');
      // percentRemaining === thresholdPercent → `<=` includes the boundary.
      expect(d.isApproachingLimit(10)).toBe(true);
    });

    it('is false just above the threshold boundary', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '11', String(NOW_SECONDS + 60)), '/a');
      expect(d.isApproachingLimit(10)).toBe(false);
    });

    it('counts in-flight requests against remaining, tripping the threshold early', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '15', String(NOW_SECONDS + 60)), '/a');
      // 15 remaining alone is above 10%, but 10 in-flight → effective 5 → 5%.
      expect(d.isApproachingLimit(10, 0)).toBe(false);
      expect(d.isApproachingLimit(10, 10)).toBe(true);
    });

    it('floors effective remaining at zero when in-flight exceeds remaining', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '3', String(NOW_SECONDS + 60)), '/a');
      // in-flight 10 > remaining 3 → Math.max(0, -7) === 0 → 0% → approaching.
      expect(d.isApproachingLimit(10, 10)).toBe(true);
    });

    it('respects a custom threshold percentage', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '40', String(NOW_SECONDS + 60)), '/a');
      expect(d.isApproachingLimit(50)).toBe(true);
      expect(d.isApproachingLimit(30)).toBe(false);
    });
  });

  describe('isLimitExceeded', () => {
    it('is false when nothing has been tracked', () => {
      expect(new RateLimitDetector().isLimitExceeded()).toBe(false);
    });

    it('is false while remaining is positive', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '1', String(NOW_SECONDS + 60)), '/a');
      expect(d.isLimitExceeded()).toBe(false);
    });

    it('is true when remaining hits zero', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '0', String(NOW_SECONDS + 60)), '/a');
      expect(d.isLimitExceeded()).toBe(true);
    });

    it('is true when remaining is reported negative', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '-2', String(NOW_SECONDS + 60)), '/a');
      expect(d.isLimitExceeded()).toBe(true);
    });
  });

  describe('getSecondsUntilReset / getMillisecondsUntilReset', () => {
    it('returns 0 when there is no tracked limit', () => {
      const d = new RateLimitDetector();
      expect(d.getSecondsUntilReset()).toBe(0);
      expect(d.getMillisecondsUntilReset()).toBe(0);
    });

    it('computes seconds/ms for a reset in the future', () => {
      const d = new RateLimitDetector();
      const info = d.parseHeaders(headers('100', '90', String(NOW_SECONDS + 45)), '/a')!;
      expect(d.getSecondsUntilReset(info)).toBe(45);
      expect(d.getMillisecondsUntilReset(info)).toBe(45_000);
    });

    it('floors to 0 for a reset in the past', () => {
      const d = new RateLimitDetector();
      // Pass explicit info so the expired-eviction in getMostRestrictive doesn't
      // clear it before we measure.
      const info = {
        limit: 100,
        remaining: 90,
        reset: NOW_SECONDS - 30,
        endpoint: '/a',
        timestamp: NOW_MS,
      };
      expect(d.getSecondsUntilReset(info)).toBe(0);
      expect(d.getMillisecondsUntilReset(info)).toBe(0);
    });

    it('returns 0 when the reset time is exactly now', () => {
      const d = new RateLimitDetector();
      const info = {
        limit: 100,
        remaining: 90,
        reset: NOW_SECONDS,
        endpoint: '/a',
        timestamp: NOW_MS,
      };
      expect(d.getSecondsUntilReset(info)).toBe(0);
    });

    it('falls back to the most-restrictive limit when no info is passed', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '90', String(NOW_SECONDS + 20)), '/a');
      expect(d.getSecondsUntilReset()).toBe(20);
    });
  });

  describe('getRecommendedWaitTime', () => {
    it('is 0 when not approaching the limit', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '90', String(NOW_SECONDS + 60)), '/a');
      expect(d.getRecommendedWaitTime()).toBe(0);
    });

    it('waits until reset when the limit is fully exceeded', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '0', String(NOW_SECONDS + 30)), '/a');
      // remaining 0 → approaching → exceeded branch → ms until reset.
      expect(d.getRecommendedWaitTime()).toBe(30_000);
    });

    it('spreads remaining requests across the window when approaching', () => {
      const d = new RateLimitDetector();
      // remaining 5 of 100 → 5% ≤ 10% → approaching, not exceeded.
      d.parseHeaders(headers('100', '5', String(NOW_SECONDS + 50)), '/a');
      // 50s / 5 = 10s per request → 10000ms.
      expect(d.getRecommendedWaitTime()).toBe(10_000);
    });

    it('enforces a 1s floor between requests when the spread is tiny', () => {
      const d = new RateLimitDetector();
      // remaining 10 of 100 → 10% boundary → approaching. reset only 2s away.
      d.parseHeaders(headers('100', '10', String(NOW_SECONDS + 2)), '/a');
      // 2s / 10 = 0.2s → ceil 200ms → floored up to 1000ms.
      expect(d.getRecommendedWaitTime()).toBe(1_000);
    });
  });

  describe('getMostRestrictive expiry cleanup', () => {
    it('drops all limits and returns null once every entry has expired', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '10', String(NOW_SECONDS + 5)), '/a');
      d.parseHeaders(headers('100', '50', String(NOW_SECONDS + 5)), '/b');

      vi.setSystemTime((NOW_SECONDS + 6) * 1000);
      expect(d.getMostRestrictive()).toBeNull();
      expect(d.getState().endpointLimits).toHaveLength(0);
    });

    it('recomputes the global from survivors when one endpoint expires', () => {
      const d = new RateLimitDetector();
      // /low is most restrictive but expires first; /high outlives it.
      d.parseHeaders(headers('100', '5', String(NOW_SECONDS + 5)), '/low');
      d.parseHeaders(headers('100', '60', String(NOW_SECONDS + 100)), '/high');
      expect(d.getMostRestrictive()?.endpoint).toBe('/low');

      vi.setSystemTime((NOW_SECONDS + 6) * 1000);
      // /low is gone; the global is recomputed to the surviving /high.
      expect(d.getMostRestrictive()?.endpoint).toBe('/high');
    });
  });

  describe('reset', () => {
    it('clears per-endpoint and global tracking', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '5', String(NOW_SECONDS + 60)), '/a');
      d.reset();
      expect(d.getMostRestrictive()).toBeNull();
      expect(d.getForEndpoint('/a')).toBeNull();
      expect(d.getState().endpointLimits).toHaveLength(0);
    });
  });

  describe('getState', () => {
    it('reports the global limit and each live endpoint entry', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '30', String(NOW_SECONDS + 60)), '/a');
      d.parseHeaders(headers('100', '70', String(NOW_SECONDS + 60)), '/b');

      const state = d.getState();
      expect(state.globalLimit?.endpoint).toBe('/a');
      expect(state.endpointLimits.map((e) => e.endpoint).sort()).toEqual(['/a', '/b']);
    });
  });
});
