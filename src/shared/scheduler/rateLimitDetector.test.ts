/**
 * Tests for RateLimitDetector — the scheduler's parser/tracker of Okta
 * `X-Rate-Limit-*` headers. These pin the pure header-math contract: per-bucket
 * + most-restrictive global tracking, in-flight-aware threshold checks, and
 * reset/cooldown computation. Time is frozen with fake timers so `Date.now()`
 * reads are deterministic — no real clocks that could make branches flaky.
 *
 * Most cases below key on paths like `/a` and `/b`, which are not
 * `/api/v1/{resource}` paths and therefore bucket to themselves — so the
 * pre-bucketing expectations they encode still hold exactly. The bucketing
 * behaviour proper is pinned in its own describe block.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimitDetector, bucketOf } from './rateLimitDetector';

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

describe('bucketOf', () => {
  it.each([
    ['/api/v1/apps', '/api/v1/apps'],
    ['/api/v1/apps?limit=200', '/api/v1/apps'],
    ['/api/v1/apps/0oaFAKE1/groups?limit=200', '/api/v1/apps'],
    ['/api/v1/apps/0oaFAKE1/users?after=abc%2Bdef', '/api/v1/apps'],
    ['/api/v1/groups/00gFAKE1/users?expand=group-rules', '/api/v1/groups'],
    ['/api/v1/rate-limit-settings/warning-threshold', '/api/v1/rate-limit-settings'],
  ])('buckets %s to %s', (endpoint, bucket) => {
    expect(bucketOf(endpoint)).toBe(bucket);
  });

  it('leaves a non-/api/v1 path in a bucket of its own', () => {
    // Isolating an unrecognised surface is the safe direction: pooling it with
    // a real family would let that family's budget be spent twice over.
    expect(bucketOf('/oauth2/v1/token')).toBe('/oauth2/v1/token');
    expect(bucketOf('/api/v2/apps')).toBe('/api/v2/apps');
  });
});

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

    // ADR-0022 note: this case used to be titled "yields NaN fields for
    // malformed numeric headers but still stores them" and asserted
    // `Number.isNaN` on all three fields — it pinned the *bug* D-086 names, not
    // a contract. It is retargeted, not deleted: the same input (truthy,
    // non-numeric headers that clear the presence guard and reach the numeric
    // parse) is still exercised, and the assertions now name the safe outcome.
    // What stays covered: malformed-but-present headers are distinguishable
    // from absent ones and are handled explicitly. What changed: the
    // observation is no longer recorded, so "unreadable" is the module's
    // existing "unknown" — an absent entry — instead of a stored NaN that read
    // as calm at every threshold comparison.
    it('treats malformed numeric headers as unknown and records nothing', () => {
      const d = new RateLimitDetector();
      expect(d.parseHeaders(headers('abc', 'xyz', 'nope'), '/api/v1/malformed')).toBeNull();

      // Unknown is the absent entry — the same shape as a bucket never seen.
      expect(d.getForBucket('/api/v1/malformed')).toBeNull();
      expect(d.getMostRestrictive()).toBeNull();
      expect(d.getState().bucketLimits).toHaveLength(0);
      // Unknown is not exhaustion either, so it can never stall the queue on a
      // reset time nobody can compute.
      expect(d.isLimitExceeded('/api/v1/malformed')).toBe(false);
      expect(d.getRecommendedWaitTime()).toBe(0);
    });

    it('rejects the whole observation when a single field is unreadable', () => {
      const d = new RateLimitDetector();
      // A budget with no readable reset can never expire; a reset with no
      // readable budget cannot be judged against a threshold.
      expect(d.parseHeaders(headers('100', '5', 'nope'), '/api/v1/apps')).toBeNull();
      expect(
        d.parseHeaders(headers('abc', '5', String(NOW_SECONDS + 60)), '/api/v1/apps'),
      ).toBeNull();
      expect(
        d.parseHeaders(headers('100', 'xyz', String(NOW_SECONDS + 60)), '/api/v1/apps'),
      ).toBeNull();
      expect(d.getState().bucketLimits).toHaveLength(0);
    });

    it('does not let an unreadable observation mask real pressure in the global backstop', () => {
      const d = new RateLimitDetector();
      // Order matters: the unreadable one lands first, so under the old code it
      // seeded the recomputed global and — never expiring, never losing a
      // NaN comparison — reported calm forever while /api/v1/apps sat at 5%.
      d.parseHeaders(headers('abc', 'xyz', 'nope'), '/api/v1/malformed');
      d.parseHeaders(headers('100', '5', String(NOW_SECONDS + 60)), '/api/v1/apps');

      expect(d.getMostRestrictive()?.bucket).toBe('/api/v1/apps');
      expect(d.isApproachingLimit(10)).toBe(true);
    });

    it('keeps the last good observation when a later response for the bucket is unreadable', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '5', String(NOW_SECONDS + 60)), '/api/v1/apps?limit=200');
      expect(
        d.parseHeaders(
          headers('100', 'xyz', String(NOW_SECONDS + 60)),
          '/api/v1/apps/0oaFAKE1/groups',
        ),
      ).toBeNull();

      // The newest *readable* answer still stands; garbage does not overwrite it.
      expect(d.getForBucket('/api/v1/apps')?.remaining).toBe(5);
      expect(d.isApproachingLimit(10, 0, '/api/v1/apps')).toBe(true);
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
        bucket: '/a',
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
        bucket: '/a',
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
      expect(d.getState().bucketLimits).toHaveLength(0);
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
      expect(d.getState().bucketLimits).toHaveLength(0);
    });
  });

  describe('bucketed tracking', () => {
    it('merges every /api/v1/apps* observation onto one bucket', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('600', '500', String(NOW_SECONDS + 60)), '/api/v1/apps?limit=200');
      d.parseHeaders(
        headers('600', '120', String(NOW_SECONDS + 60)),
        '/api/v1/apps/0oaFAKE1/groups?limit=200',
      );

      // One entry, not two — and it carries the latest answer, because Okta's
      // headers describe the budget as of that response.
      expect(d.getState().bucketLimits).toHaveLength(1);
      expect(d.getForBucket('/api/v1/apps')?.remaining).toBe(120);
      // Any endpoint in the family resolves to it.
      expect(d.getForEndpoint('/api/v1/apps/0oaFAKE9/users?limit=1')?.remaining).toBe(120);
    });

    it('does not let one family answer for another', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '2', String(NOW_SECONDS + 60)), '/api/v1/apps?limit=200');
      d.parseHeaders(headers('100', '95', String(NOW_SECONDS + 60)), '/api/v1/groups?limit=200');

      expect(d.isApproachingLimit(10, 0, '/api/v1/apps')).toBe(true);
      expect(d.isApproachingLimit(10, 0, '/api/v1/groups')).toBe(false);
      // Omitting the bucket still asks the most-restrictive-anywhere question,
      // which is what keeps the global backstop honest.
      expect(d.isApproachingLimit(10, 0)).toBe(true);
    });

    it('answers isLimitExceeded per bucket as well as globally', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '0', String(NOW_SECONDS + 60)), '/api/v1/apps?limit=200');
      d.parseHeaders(headers('100', '95', String(NOW_SECONDS + 60)), '/api/v1/groups?limit=200');

      expect(d.isLimitExceeded('/api/v1/apps')).toBe(true);
      expect(d.isLimitExceeded('/api/v1/groups')).toBe(false);
      expect(d.isLimitExceeded()).toBe(true);
    });

    it('does not grow an entry per pagination cursor', () => {
      const d = new RateLimitDetector();
      for (let page = 0; page < 25; page++) {
        d.parseHeaders(
          headers('600', String(600 - page), String(NOW_SECONDS + 60)),
          `/api/v1/apps?limit=200&after=cursor${page}`,
        );
      }
      expect(d.getState().bucketLimits).toHaveLength(1);
    });

    it('reports an unseen bucket as unknown, never as exhausted', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '0', String(NOW_SECONDS + 60)), '/api/v1/apps?limit=200');

      // No observation for users at all. Absence is not evidence of exhaustion.
      expect(d.getForBucket('/api/v1/users')).toBeNull();
      expect(d.isApproachingLimit(10, 0, '/api/v1/users')).toBe(false);
      expect(d.isLimitExceeded('/api/v1/users')).toBe(false);
    });
  });

  describe('getState', () => {
    it('reports the global limit and each live endpoint entry', () => {
      const d = new RateLimitDetector();
      d.parseHeaders(headers('100', '30', String(NOW_SECONDS + 60)), '/a');
      d.parseHeaders(headers('100', '70', String(NOW_SECONDS + 60)), '/b');

      const state = d.getState();
      expect(state.globalLimit?.endpoint).toBe('/a');
      expect(state.bucketLimits.map((entry) => entry.bucket).sort()).toEqual(['/a', '/b']);
    });
  });
});
