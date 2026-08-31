/**
 * Plan-accuracy tests: does what an operation *declared* match what it *spent*?
 *
 * This is the suite that stops estimates rotting. Asserting that a plan was
 * declared proves only that the wiring exists; a refactor that adds a page to a
 * walk or a request to a fan-out would leave such a test green while the bar
 * quietly began lying. So these drive each operation through a known number of
 * pages and compare the settled estimate against the requests actually issued.
 *
 * The plan ledger is advisory (ADR-0060 §2), so each case also pins the other
 * half of that promise: the operation returns exactly what it returned before,
 * whatever the plan said.
 */
import { describe, it, expect, vi } from 'vitest';
import { createExportEngineOperations } from './exportEngine';
import { createGroupMemberOperations } from './groupMembers';
import { makeFakeCore } from '@/test/factories/coreApi';
import type { PlanEstimate, PlanLegInput } from '@/shared/scheduler/plan';
import type { EntityExport } from '@/sidepanel/export/types';
import type { RequestResult } from '@/shared/scheduler/types';
import { z } from 'zod';

vi.mock('@/shared/storage/auditStore', () => ({
  auditStore: { logOperation: vi.fn().mockResolvedValue(undefined) },
}));

/**
 * A `withPlan` that records what was declared and every refinement, then reports
 * the estimate the operation finished on.
 */
function recordingWithPlan() {
  const state = {
    legs: [] as PlanLegInput[],
    refinements: [] as PlanEstimate[],
    /** The estimate the plan closed on: the last refinement, or the declaration. */
    finalEstimate(): PlanEstimate | undefined {
      return this.refinements.at(-1) ?? this.legs[0]?.estimate;
    },
  };

  const withPlan = vi.fn(
    async (
      _name: string,
      legs: PlanLegInput[],
      run: (handle: { planId: string; refine: (e: string, x: PlanEstimate) => void }) => unknown,
    ) => {
      state.legs = legs;
      return run({
        planId: 'plan-under-test',
        refine: (_endpoint, estimate) => state.refinements.push(estimate),
      });
    },
  );

  return { withPlan, state };
}

/** Wrap a path in an Okta-style `rel="next"` Link header. */
function nextLink(path: string): string {
  return `<https://example.okta.com${path}>; rel="next"`;
}

/**
 * A transport that serves `pageCount` pages of `rowsPerPage` rows and counts the
 * requests it was actually asked for.
 */
function paginatingTransport(pageCount: number, rowsPerPage: number, row: () => unknown) {
  const calls: string[] = [];
  const makeApiRequest = vi.fn(async (url: string, _options?: unknown): Promise<RequestResult> => {
    calls.push(url);
    const pageIndex = calls.length;
    const hasMore = pageIndex < pageCount;
    return {
      success: true,
      data: Array.from({ length: rowsPerPage }, row),
      headers: hasMore ? { link: nextLink(`/next?after=cursor${pageIndex}`) } : {},
    };
  });
  return { makeApiRequest, calls };
}

describe('export walk: declared cost matches spent cost', () => {
  const descriptor = {
    id: 'users',
    displayName: 'Users',
    schema: z.object({ id: z.string() }),
    columnCatalog: [],
  } as unknown as EntityExport<{ id: string }>;

  it.each([
    ['a single page', 1],
    ['two pages', 2],
    ['six pages', 6],
  ])('settles on an exact count matching the requests issued — %s', async (_label, pages) => {
    const { makeApiRequest, calls } = paginatingTransport(pages, 200, () => ({ id: '00uFAKE1' }));
    const { withPlan, state } = recordingWithPlan();
    const core = makeFakeCore({ makeApiRequest, withPlan });

    const result = await createExportEngineOperations(core).fetchAllRows(
      descriptor,
      '/api/v1/users?limit=200',
    );

    expect(calls).toHaveLength(pages);
    expect(state.finalEstimate()).toEqual({ kind: 'exact', requests: pages });
    // Advisory: the rows are exactly what they would have been with no plan.
    expect(result.rows).toHaveLength(pages * 200);
  });

  it('opens at a floor of one page before anything is known', async () => {
    const { makeApiRequest } = paginatingTransport(3, 200, () => ({ id: '00uFAKE1' }));
    const { withPlan, state } = recordingWithPlan();

    await createExportEngineOperations(makeFakeCore({ makeApiRequest, withPlan })).fetchAllRows(
      descriptor,
      '/api/v1/users?limit=200',
    );

    expect(state.legs[0].estimate).toEqual({ kind: 'atLeast', requests: 1 });
  });

  it('raises the floor page by page rather than jumping to a guessed total', async () => {
    const { makeApiRequest } = paginatingTransport(3, 200, () => ({ id: '00uFAKE1' }));
    const { withPlan, state } = recordingWithPlan();

    await createExportEngineOperations(makeFakeCore({ makeApiRequest, withPlan })).fetchAllRows(
      descriptor,
      '/api/v1/users?limit=200',
    );

    expect(state.refinements).toEqual([
      { kind: 'atLeast', requests: 2 },
      { kind: 'atLeast', requests: 3 },
      { kind: 'exact', requests: 3 },
    ]);
  });

  it('stops promising pages the row cap just cancelled', async () => {
    // The cap ends the walk while the Link header still promises more. Without
    // the explicit settle the plan would sit at `atLeast 2` forever, showing
    // work the export had already decided not to do.
    const capped = { ...descriptor, maxRows: 200 } as unknown as EntityExport<{ id: string }>;
    const { makeApiRequest, calls } = paginatingTransport(5, 200, () => ({ id: '00uFAKE1' }));
    const { withPlan, state } = recordingWithPlan();

    const result = await createExportEngineOperations(
      makeFakeCore({ makeApiRequest, withPlan }),
    ).fetchAllRows(capped, '/api/v1/users?limit=200');

    expect(result.capped).toBe(true);
    expect(calls).toHaveLength(1);
    expect(state.finalEstimate()).toEqual({ kind: 'exact', requests: 1 });
  });

  it('attributes every page to the plan, not just the first', async () => {
    const { makeApiRequest } = paginatingTransport(4, 200, () => ({ id: '00uFAKE1' }));
    const { withPlan } = recordingWithPlan();

    await createExportEngineOperations(makeFakeCore({ makeApiRequest, withPlan })).fetchAllRows(
      descriptor,
      '/api/v1/users?limit=200',
    );

    expect(makeApiRequest).toHaveBeenCalledTimes(4);
    for (const call of makeApiRequest.mock.calls) {
      expect(call[1]).toMatchObject({ planId: 'plan-under-test' });
    }
  });
});

describe('group member walk: a free member count prices the walk exactly', () => {
  const member = () => ({
    id: '00uFAKE1',
    status: 'ACTIVE',
    profile: {
      login: 'ada@example.com',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Fake',
    },
  });

  it.each([
    ['200 members', 200, 1],
    ['201 members', 201, 2],
    ['1000 members', 1000, 5],
    ['an empty group', 0, 1],
  ])(
    'declares the exact page count from the expand=stats total — %s',
    async (_label, memberCount, expectedPages) => {
      const { makeApiRequest } = paginatingTransport(expectedPages, 200, member);
      const { withPlan, state } = recordingWithPlan();

      await createGroupMemberOperations(
        makeFakeCore({ makeApiRequest, withPlan }),
      ).getAllGroupMembers('00gFAKE1', { memberCount });

      // Declared up front, from a number that cost nothing — and matching the
      // requests the walk then actually made.
      expect(state.legs[0].estimate).toEqual({ kind: 'exact', requests: expectedPages });
      expect(makeApiRequest).toHaveBeenCalledTimes(expectedPages);
    },
  );

  it('falls back to a floor when no member count was supplied', async () => {
    const { makeApiRequest } = paginatingTransport(1, 200, member);
    const { withPlan, state } = recordingWithPlan();

    await createGroupMemberOperations(
      makeFakeCore({ makeApiRequest, withPlan }),
    ).getAllGroupMembers('00gFAKE1');

    expect(state.legs[0].estimate).toEqual({ kind: 'atLeast', requests: 1 });
  });

  it('joins a caller-s plan instead of opening a second one', async () => {
    // A rule-impact preview across five groups should read as one row in the
    // bar, not five, so a supplied planId suppresses the nested declaration.
    const { makeApiRequest } = paginatingTransport(1, 200, member);
    const { withPlan } = recordingWithPlan();

    await createGroupMemberOperations(
      makeFakeCore({ makeApiRequest, withPlan }),
    ).getAllGroupMembers('00gFAKE1', { planId: 'callers-plan' });

    expect(withPlan).not.toHaveBeenCalled();
    expect(makeApiRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ planId: 'callers-plan' }),
    );
  });

  it('spends no probe request to learn what it declares', async () => {
    // The whole estimator contract: every number comes from something already
    // paid for. A walk of one page must cost exactly one request.
    const { makeApiRequest } = paginatingTransport(1, 200, member);
    const { withPlan } = recordingWithPlan();

    await createGroupMemberOperations(
      makeFakeCore({ makeApiRequest, withPlan }),
    ).getAllGroupMembers('00gFAKE1', { memberCount: 200 });

    expect(makeApiRequest).toHaveBeenCalledTimes(1);
  });
});
