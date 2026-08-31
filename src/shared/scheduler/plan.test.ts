import { describe, it, expect } from 'vitest';
import {
  PlanRegistry,
  PLAN_STALE_MS,
  MAX_TRACKED_PLANS,
  MAX_LEGS_PER_PLAN,
  type PlanDeclaration,
} from './plan';

/**
 * Stand-in for `bucketOf`: first `/api/v1/{resource}` segment, query stripped.
 * The registry takes its bucketing by injection precisely so these tests do not
 * depend on Okta's real bucketing rule.
 */
function bucketFor(endpoint: string): string {
  const path = endpoint.split('?')[0];
  const match = /^\/api\/v1\/([^/]+)/.exec(path);
  return match ? `/api/v1/${match[1]}` : path;
}

function registry(): PlanRegistry {
  return new PlanRegistry(bucketFor);
}

function declaration(overrides: Partial<PlanDeclaration> = {}): PlanDeclaration {
  return {
    id: 'plan-1',
    name: 'Export all users',
    tabId: 7,
    legs: [{ endpoint: '/api/v1/users?limit=200', estimate: { kind: 'exact', requests: 5 } }],
    ...overrides,
  };
}

describe('PlanRegistry', () => {
  describe('declare', () => {
    it('buckets each leg endpoint rather than storing the raw URL', () => {
      const reg = registry();
      const plan = reg.declare(
        declaration({
          legs: [
            { endpoint: '/api/v1/apps/00aFAKE/groups?limit=200', estimate: { kind: 'unknown' } },
          ],
        }),
      );

      expect(plan?.legs[0].bucket).toBe('/api/v1/apps');
    });

    it('is idempotent, so a retried message cannot reset spent counters', () => {
      const reg = registry();
      reg.declare(declaration());
      reg.attribute('plan-1', '/api/v1/users');
      reg.attribute('plan-1', '/api/v1/users');

      reg.declare(declaration());

      expect(reg.summarize()[0].spent).toBe(2);
    });

    it('rejects a declaration with no legs', () => {
      expect(registry().declare(declaration({ legs: [] }))).toBeNull();
    });

    it('treats a negative or non-finite request count as unknown', () => {
      const reg = registry();
      reg.declare(
        declaration({
          legs: [
            { endpoint: '/api/v1/users', estimate: { kind: 'exact', requests: -4 } },
            { endpoint: '/api/v1/groups', estimate: { kind: 'exact', requests: Number.NaN } },
          ],
        }),
      );

      const [summary] = reg.summarize();
      expect(summary.legs.map((leg) => leg.estimated)).toEqual([null, null]);
      expect(summary.estimated).toBeNull();
    });

    it('truncates legs at the per-plan cap', () => {
      const reg = registry();
      const legs = Array.from({ length: MAX_LEGS_PER_PLAN + 5 }, (_, i) => ({
        endpoint: `/api/v1/res${i}`,
        estimate: { kind: 'exact' as const, requests: 1 },
      }));

      expect(reg.declare(declaration({ legs }))?.legs).toHaveLength(MAX_LEGS_PER_PLAN);
    });

    it('refuses to track more than the plan cap', () => {
      const reg = registry();
      for (let i = 0; i < MAX_TRACKED_PLANS; i++) {
        expect(reg.declare(declaration({ id: `plan-${i}` }))).not.toBeNull();
      }

      expect(reg.declare(declaration({ id: 'one-too-many' }))).toBeNull();
    });
  });

  describe('attribute', () => {
    it('charges the leg whose bucket matches the settled endpoint', () => {
      const reg = registry();
      reg.declare(
        declaration({
          legs: [
            { endpoint: '/api/v1/users', estimate: { kind: 'exact', requests: 3 } },
            { endpoint: '/api/v1/groups', estimate: { kind: 'exact', requests: 2 } },
          ],
        }),
      );

      reg.attribute('plan-1', '/api/v1/groups?limit=200&after=abc');

      const [summary] = reg.summarize();
      expect(summary.legs.find((leg) => leg.bucket === '/api/v1/groups')?.spent).toBe(1);
      expect(summary.legs.find((leg) => leg.bucket === '/api/v1/users')?.spent).toBe(0);
    });

    it('appends an unknown-estimate leg when an operation under-declared', () => {
      const reg = registry();
      reg.declare(declaration());

      reg.attribute('plan-1', '/api/v1/factors');

      const [summary] = reg.summarize();
      const appended = summary.legs.find((leg) => leg.bucket === '/api/v1/factors');
      expect(appended).toMatchObject({ spent: 1, estimated: null, remaining: null });
      // The under-declaration is visible rather than silently dropped.
      expect(summary.approximate).toBe(true);
    });

    it('does not append past the leg cap', () => {
      const reg = registry();
      const legs = Array.from({ length: MAX_LEGS_PER_PLAN }, (_, i) => ({
        endpoint: `/api/v1/res${i}`,
        estimate: { kind: 'exact' as const, requests: 1 },
      }));
      reg.declare(declaration({ legs }));

      reg.attribute('plan-1', '/api/v1/undeclared');

      expect(reg.summarize()[0].legs).toHaveLength(MAX_LEGS_PER_PLAN);
    });

    it('ignores an unknown plan id', () => {
      const reg = registry();
      expect(() => reg.attribute('never-declared', '/api/v1/users')).not.toThrow();
      expect(reg.summarize()).toEqual([]);
    });

    it('ignores attribution after the plan settled', () => {
      const reg = registry();
      reg.declare(declaration());
      reg.complete('plan-1');

      reg.attribute('plan-1', '/api/v1/users');

      expect(reg.summarize()).toEqual([]);
    });
  });

  describe('refine', () => {
    it('grows an atLeast estimate as pages land', () => {
      const reg = registry();
      reg.declare(
        declaration({
          legs: [{ endpoint: '/api/v1/users', estimate: { kind: 'atLeast', requests: 1 } }],
        }),
      );

      reg.refine('plan-1', '/api/v1/users?after=cursor', { kind: 'atLeast', requests: 4 });

      const [summary] = reg.summarize();
      expect(summary.estimated).toBe(4);
      expect(summary.approximate).toBe(true);
    });

    it('settles to exact when the walk ends', () => {
      const reg = registry();
      reg.declare(
        declaration({
          legs: [{ endpoint: '/api/v1/users', estimate: { kind: 'atLeast', requests: 3 } }],
        }),
      );

      reg.refine('plan-1', '/api/v1/users', { kind: 'exact', requests: 3 });

      expect(reg.summarize()[0].approximate).toBe(false);
    });

    it('addresses the leg by bucket, so any URL in the family finds it', () => {
      const reg = registry();
      reg.declare(
        declaration({
          legs: [{ endpoint: '/api/v1/apps', estimate: { kind: 'atLeast', requests: 1 } }],
        }),
      );

      reg.refine('plan-1', '/api/v1/apps/00aFAKE/users?limit=200', {
        kind: 'exact',
        requests: 9,
      });

      expect(reg.summarize()[0].estimated).toBe(9);
    });

    it('ignores a refinement for a bucket the plan never declared', () => {
      const reg = registry();
      reg.declare(declaration());

      reg.refine('plan-1', '/api/v1/zones', { kind: 'exact', requests: 100 });

      expect(reg.summarize()[0].estimated).toBe(5);
    });

    it('ignores a refinement arriving after a cancel', () => {
      const reg = registry();
      reg.declare(declaration());
      reg.cancel('plan-1');

      expect(() =>
        reg.refine('plan-1', '/api/v1/users', { kind: 'exact', requests: 99 }),
      ).not.toThrow();
      expect(reg.summarize()).toEqual([]);
    });
  });

  describe('remaining and planned', () => {
    it('never reports negative remaining when an operation overruns its estimate', () => {
      const reg = registry();
      reg.declare(
        declaration({
          legs: [{ endpoint: '/api/v1/users', estimate: { kind: 'exact', requests: 2 } }],
        }),
      );

      for (let i = 0; i < 5; i++) reg.attribute('plan-1', '/api/v1/users');

      const [summary] = reg.summarize();
      expect(summary.spent).toBe(5);
      expect(summary.remaining).toBe(0);
      expect(summary.legs[0].remaining).toBe(0);
      expect(reg.plannedForBucket('/api/v1/users')).toBe(0);
    });

    it('sums planned work for a bucket across every active plan', () => {
      const reg = registry();
      reg.declare(
        declaration({
          id: 'a',
          legs: [{ endpoint: '/api/v1/users', estimate: { kind: 'exact', requests: 10 } }],
        }),
      );
      reg.declare(
        declaration({
          id: 'b',
          legs: [{ endpoint: '/api/v1/users?limit=1', estimate: { kind: 'exact', requests: 4 } }],
        }),
      );
      reg.attribute('a', '/api/v1/users');

      expect(reg.plannedForBucket('/api/v1/users')).toBe(13);
    });

    it('contributes nothing for an unknown estimate rather than inventing a number', () => {
      const reg = registry();
      reg.declare(
        declaration({
          legs: [{ endpoint: '/api/v1/users', estimate: { kind: 'unknown' } }],
        }),
      );

      expect(reg.plannedForBucket('/api/v1/users')).toBe(0);
      expect(reg.summarize()[0].estimated).toBeNull();
    });

    it('drops a settled plan out of the planned total', () => {
      const reg = registry();
      reg.declare(declaration());
      expect(reg.plannedForBucket('/api/v1/users')).toBe(5);

      reg.complete('plan-1');

      expect(reg.plannedForBucket('/api/v1/users')).toBe(0);
    });

    it('lists every bucket active plans intend to touch', () => {
      const reg = registry();
      reg.declare(
        declaration({
          legs: [
            { endpoint: '/api/v1/users', estimate: { kind: 'exact', requests: 1 } },
            { endpoint: '/api/v1/apps/00aFAKE/groups', estimate: { kind: 'unknown' } },
          ],
        }),
      );

      expect([...reg.plannedBuckets()].sort()).toEqual(['/api/v1/apps', '/api/v1/users']);
    });
  });

  describe('summarize', () => {
    it('totals only the legs that have a usable estimate', () => {
      const reg = registry();
      reg.declare(
        declaration({
          legs: [
            { endpoint: '/api/v1/users', estimate: { kind: 'exact', requests: 6 } },
            { endpoint: '/api/v1/groups', estimate: { kind: 'unknown' } },
          ],
        }),
      );
      reg.attribute('plan-1', '/api/v1/users');

      const [summary] = reg.summarize();
      expect(summary.estimated).toBe(6);
      expect(summary.spent).toBe(1);
      expect(summary.remaining).toBe(5);
      // An unknown leg makes the whole total a floor.
      expect(summary.approximate).toBe(true);
    });

    it('orders plans oldest first so the bar does not reshuffle', () => {
      const reg = registry();
      reg.declare(declaration({ id: 'first', name: 'First' }));
      reg.declare(declaration({ id: 'second', name: 'Second' }));

      expect(reg.summarize().map((plan) => plan.name)).toEqual(['First', 'Second']);
    });

    it('excludes cancelled and completed plans', () => {
      const reg = registry();
      reg.declare(declaration({ id: 'a' }));
      reg.declare(declaration({ id: 'b' }));
      reg.declare(declaration({ id: 'c' }));

      reg.complete('a');
      reg.cancel('b');

      expect(reg.summarize().map((plan) => plan.id)).toEqual(['c']);
    });
  });

  describe('reaping', () => {
    it('drops a plan that has gone quiet past the stale window', () => {
      const reg = registry();
      reg.declare(declaration());

      reg.reap(Date.now() + PLAN_STALE_MS + 1);

      expect(reg.summarize()).toEqual([]);
      expect(reg.has('plan-1')).toBe(false);
    });

    it('keeps a plan that is still settling requests', () => {
      const reg = registry();
      reg.declare(declaration());
      reg.attribute('plan-1', '/api/v1/users');

      reg.reap(Date.now() + PLAN_STALE_MS - 1_000);

      expect(reg.has('plan-1')).toBe(true);
    });
  });

  it('reset forgets everything', () => {
    const reg = registry();
    reg.declare(declaration());
    reg.reset();

    expect(reg.summarize()).toEqual([]);
    expect(reg.has('plan-1')).toBe(false);
  });
});
