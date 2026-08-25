/**
 * `useGroupSource` guard branches: the stale-run checks that keep a superseded
 * load from writing state, and `resummarize`'s no-open-group short circuit.
 *
 * Both loads in this hook are fire-and-forget promises whose `.then`/`.catch`
 * can land *after* the user has moved on — reopened the insight for a different
 * group, or closed it outright. `runIdRef` is what makes that safe: `open` and
 * `close` bump it, and every continuation compares the id it captured before
 * touching state. This file pins both sides of each of those comparisons, so a
 * later refactor cannot quietly drop one and reintroduce "closed the modal, then
 * a breakdown appeared".
 *
 * Mocked at the `useOktaApi` facade (docs/testing.md): the loads are handed out
 * as deferreds so a test can decide the exact moment each one settles relative
 * to `open`/`close`. Scheduler-level cost is a different question and is pinned
 * separately in `useGroupSource.requestCount.test.ts`, which also covers the
 * non-stale sides of the `analyzeMembers` success path and both sides of
 * `resummarize`'s `!rules` term.
 *
 * Fixtures use fake placeholders (`00gFAKE…`, `00uFAKE…`, `example.com`) only.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { FormattedRule, GroupSummary, OktaUser } from '../../shared/types';

const api = vi.hoisted(() => ({
  getGroupRulesForGroup: vi.fn(),
  getAllGroupMembers: vi.fn(),
}));

vi.mock('./useOktaApi', () => ({
  useOktaApi: () => api,
}));

import { useGroupSource } from './useGroupSource';

/** A promise plus the handles to settle it later, from the test body. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeGroup(id: string, name: string): GroupSummary {
  return { id, name, type: 'OKTA_GROUP', memberCount: 0, hasRules: true, ruleCount: 1 };
}

const groupA = makeGroup('00gFAKEGROUPA', 'Fake Engineering');
const groupB = makeGroup('00gFAKEGROUPB', 'Fake Support');

function makeRule(id: string, name: string): FormattedRule {
  return {
    id,
    name,
    status: 'ACTIVE',
    condition: 'department equals Engineering',
    conditionExpression: 'user.department == "Engineering"',
    groupIds: [groupA.id, groupB.id],
    userAttributes: ['department'],
    created: '2020-01-01T00:00:00.000Z',
    lastUpdated: '2024-01-01T00:00:00.000Z',
  };
}

const ruleA = makeRule('0prFAKERULEA', 'Engineering feeder');
const ruleB = makeRule('0prFAKERULEB', 'Support feeder');

function makeMember(index: number): OktaUser {
  return {
    id: `00uFAKE${index}`,
    status: 'ACTIVE',
    profile: {
      login: `user${index}@example.com`,
      email: `user${index}@example.com`,
      firstName: 'Fake',
      lastName: `User${index}`,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // log.error routes to console.error; the failure cases below expect it.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/*
  RETARGETED. These two used to spell out a five-field projection, because
  `FeedingRule` was a narrowing of `FormattedRule` that dropped `condition`,
  `groupIds`, `created` and `lastUpdated`. `getGroupRulesForGroup` always returned
  the full rule, and the Group Detail Rules tab now renders it, so the hook passes
  it through untouched. Same property — which run's rules were applied — asserted
  against the whole rule instead of a hand-copied subset, which is strictly the
  stronger check: a dropped field now fails here.
*/
describe('useGroupSource.open — stale-run guard on the rules load', () => {
  it('applies the rules of the run that is still current', async () => {
    api.getGroupRulesForGroup.mockResolvedValue([ruleA]);

    const { result } = renderHook(() => useGroupSource(1));
    await act(async () => {
      result.current.open(groupA);
    });

    await waitFor(() => expect(result.current.rulesStatus).toBe('done'));
    expect(result.current.feedingRules).toEqual([ruleA]);
    expect(result.current.error).toBeNull();
  });

  it('drops the rules of a run superseded by reopening for another group', async () => {
    const first = deferred<FormattedRule[]>();
    const second = deferred<FormattedRule[]>();
    api.getGroupRulesForGroup
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useGroupSource(1));
    await act(async () => {
      result.current.open(groupA);
    });
    await act(async () => {
      result.current.open(groupB);
    });

    // Group A's load lands late. It belongs to a run the user has left.
    await act(async () => {
      first.resolve([ruleA]);
      await first.promise;
    });

    expect(result.current.group).toEqual(groupB);
    expect(result.current.feedingRules).toEqual([]);
    expect(result.current.rulesStatus).toBe('loading');

    // The run that IS current still lands normally afterwards.
    await act(async () => {
      second.resolve([ruleB]);
      await second.promise;
    });
    await waitFor(() => expect(result.current.rulesStatus).toBe('done'));
    expect(result.current.feedingRules).toEqual([ruleB]);
  });

  it('surfaces a rules failure from the current run', async () => {
    api.getGroupRulesForGroup.mockRejectedValue(new Error('Okta said no'));

    const { result } = renderHook(() => useGroupSource(1));
    await act(async () => {
      result.current.open(groupA);
    });

    await waitFor(() => expect(result.current.rulesStatus).toBe('error'));
    expect(result.current.error).toBe('Okta said no');
  });

  it('falls back to a generic message when the rejection is not an Error', async () => {
    api.getGroupRulesForGroup.mockRejectedValue('not-an-error');

    const { result } = renderHook(() => useGroupSource(1));
    await act(async () => {
      result.current.open(groupA);
    });

    await waitFor(() => expect(result.current.rulesStatus).toBe('error'));
    expect(result.current.error).toBe('Failed to load feeding rules');
  });

  it('swallows a rules failure that belongs to a superseded run', async () => {
    const first = deferred<FormattedRule[]>();
    const second = deferred<FormattedRule[]>();
    api.getGroupRulesForGroup
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useGroupSource(1));
    await act(async () => {
      result.current.open(groupA);
    });
    await act(async () => {
      result.current.open(groupB);
    });

    await act(async () => {
      first.reject(new Error('Okta said no'));
      await first.promise.catch(() => {});
    });

    // The abandoned run must not paint an error over the run in progress.
    expect(result.current.error).toBeNull();
    expect(result.current.rulesStatus).toBe('loading');

    await act(async () => {
      second.resolve([ruleB]);
      await second.promise;
    });
    await waitFor(() => expect(result.current.rulesStatus).toBe('done'));
    expect(result.current.error).toBeNull();
  });
});

describe('useGroupSource.analyzeMembers — stale-run guard on the member analysis', () => {
  /** Open `groupA` with one feeding rule and wait for the rules load to settle. */
  async function openGroupA() {
    api.getGroupRulesForGroup.mockResolvedValue([ruleA]);
    const { result } = renderHook(() => useGroupSource(1));
    await act(async () => {
      result.current.open(groupA);
    });
    await waitFor(() => expect(result.current.rulesStatus).toBe('done'));
    return result;
  }

  it('drops a member analysis that lands after the insight was closed', async () => {
    const members = deferred<OktaUser[]>();
    api.getAllGroupMembers.mockReturnValue(members.promise);

    const result = await openGroupA();
    await act(async () => {
      result.current.analyzeMembers();
    });
    expect(result.current.memberStatus).toBe('loading');

    // The user closes the insight while the member walk is still in flight.
    await act(async () => {
      result.current.close();
    });

    await act(async () => {
      members.resolve([makeMember(0), makeMember(1)]);
      await members.promise;
    });

    expect(result.current.breakdown).toBeNull();
    expect(result.current.memberStatus).toBe('idle');
  });

  it('surfaces a member-analysis failure from the current run', async () => {
    api.getAllGroupMembers.mockRejectedValue(new Error('Member walk failed'));

    const result = await openGroupA();
    await act(async () => {
      result.current.analyzeMembers();
    });

    await waitFor(() => expect(result.current.memberStatus).toBe('error'));
    expect(result.current.error).toBe('Member walk failed');
    expect(result.current.breakdown).toBeNull();
  });

  it('falls back to a generic message when the rejection is not an Error', async () => {
    api.getAllGroupMembers.mockRejectedValue('not-an-error');

    const result = await openGroupA();
    await act(async () => {
      result.current.analyzeMembers();
    });

    await waitFor(() => expect(result.current.memberStatus).toBe('error'));
    expect(result.current.error).toBe('Failed to analyze members');
  });

  it('does nothing when no group is open', async () => {
    // No tab id either — the hook is mounted before a tab is connected.
    const { result } = renderHook(() => useGroupSource());

    await act(async () => {
      result.current.analyzeMembers();
    });

    expect(api.getAllGroupMembers).not.toHaveBeenCalled();
    expect(result.current.memberStatus).toBe('idle');
  });

  it('swallows a member-analysis failure that lands after close', async () => {
    const members = deferred<OktaUser[]>();
    api.getAllGroupMembers.mockReturnValue(members.promise);

    const result = await openGroupA();
    await act(async () => {
      result.current.analyzeMembers();
    });
    await act(async () => {
      result.current.close();
    });

    await act(async () => {
      members.reject(new Error('Member walk failed'));
      await members.promise.catch(() => {});
    });

    expect(result.current.error).toBeNull();
    expect(result.current.memberStatus).toBe('idle');
  });
});

/**
 * `resummarize` guards on `!group || !rules`. `close()` clears both at once, and
 * nothing else can null the group while leaving last-analysis rules behind, so
 * the two operands are only ever true together — `!group` is what lets the body
 * read `group.id` without a null check. This is the post-close half of the
 * guard; `useGroupSource.requestCount.test.ts` covers the never-analyzed half
 * and the pass-through case.
 */
describe('useGroupSource.resummarize — nothing to summarise against', () => {
  it('is a no-op once the insight has been closed', async () => {
    api.getGroupRulesForGroup.mockResolvedValue([ruleA]);
    api.getAllGroupMembers.mockResolvedValue([makeMember(0), makeMember(1)]);

    const { result } = renderHook(() => useGroupSource(1));
    await act(async () => {
      result.current.open(groupA);
    });
    await waitFor(() => expect(result.current.rulesStatus).toBe('done'));
    await act(async () => {
      result.current.analyzeMembers();
    });
    await waitFor(() => expect(result.current.memberStatus).toBe('done'));
    expect(result.current.breakdown?.total).toBe(2);

    await act(async () => {
      result.current.close();
    });

    // A membership write can report a fresh roster after the view is gone; with
    // no group in hand there is nothing to summarise against.
    await act(async () => {
      result.current.resummarize([makeMember(0)]);
    });

    expect(result.current.group).toBeNull();
    expect(result.current.breakdown).toBeNull();
  });
});
