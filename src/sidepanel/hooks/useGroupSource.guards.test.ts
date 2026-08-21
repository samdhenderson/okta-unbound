/**
 * Stale-run guards in {@link useGroupSource} (`DEBT.md` D-006).
 *
 * The hook fires two independent async loads — the feeding-rules read from
 * `open()` and the member walk from `analyzeMembers()` — and both settle long
 * after the user may have switched groups or closed the insight. Each captures
 * the `runIdRef` value current when it started and refuses to write state when
 * that counter has moved on. This file pins **both sides** of all four of those
 * guards, plus the `!group` half of `resummarize`'s guard.
 *
 * Every stale case here is a genuine interleaving: the load is really started,
 * the run is really superseded (`open()` again, or `close()`), and only then does
 * the promise settle — so removing a guard makes the corresponding case fail
 * rather than merely stop being exercised.
 *
 * The `useOktaApi` facade is mocked with hand-controlled deferreds, which is the
 * only way to hold one load open across another (`docs/testing.md`: mock at the
 * facade, never MSW). The `!rules` half of `resummarize`'s guard and the
 * scheduler-cost contract live in the sibling `useGroupSource.requestCount.test.ts`.
 *
 * All identifiers are fake placeholders (`00gFAKE…`, `00uFAKE…`, `example.com`).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGroupSource } from './useGroupSource';
import { readMemberSource } from '../cache/memberSourceCache';
import type { FormattedRule, GroupSummary, OktaUser } from '../../shared/types';

const api = {
  getGroupRulesForGroup: vi.fn(),
  getAllGroupMembers: vi.fn(),
};

vi.mock('./useOktaApi', () => ({
  useOktaApi: () => api,
}));

/** A promise whose settlement the test decides, so a load can be held open. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Drain the microtask queue by yielding to a macrotask, so a whole promise chain
 * (`getOrFetch` → `Promise.all` → `.then`) has definitely settled before the
 * assertions run. Without this a "the guard dropped it" assertion could pass
 * simply because the write had not happened *yet*.
 */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const GROUP_A: GroupSummary = {
  id: '00gFAKEALPHA1',
  name: 'Fake Alpha',
  type: 'OKTA_GROUP',
  memberCount: 2,
  hasRules: true,
  ruleCount: 1,
};

const GROUP_B: GroupSummary = {
  id: '00gFAKEBRAVO2',
  name: 'Fake Bravo',
  type: 'OKTA_GROUP',
  memberCount: 0,
  hasRules: true,
  ruleCount: 1,
};

/** A formatted feeding rule targeting `groupId`. */
function makeRule(id: string, name: string, groupId: string): FormattedRule {
  return {
    id,
    name,
    status: 'ACTIVE',
    condition: 'user.department == "Engineering"',
    groupIds: [groupId],
    groupNames: ['Fake group'],
    userAttributes: ['department'],
    created: '2026-01-01T00:00:00.000Z',
    lastUpdated: '2026-01-02T00:00:00.000Z',
  };
}

const RULE_A = makeRule('0prFAKEALPHA1', 'Alpha feeder', GROUP_A.id);
const RULE_B = makeRule('0prFAKEBRAVO2', 'Bravo feeder', GROUP_B.id);

function makeMember(index: number): OktaUser {
  return {
    id: `00uFAKE${index}`,
    status: 'ACTIVE',
    profile: {
      login: `user${index}@example.com`,
      email: `user${index}@example.com`,
      firstName: 'Fake',
      lastName: `User${index}`,
      department: 'Engineering',
    },
  };
}

const MEMBERS = [makeMember(0), makeMember(1)];

beforeEach(() => {
  api.getGroupRulesForGroup.mockReset();
  api.getAllGroupMembers.mockReset();
  // The hook logs failures through the shared logger; keep expected-error runs
  // from writing to the test console.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useGroupSource open() stale-run guard', () => {
  it('applies a rules payload that belongs to the current run', async () => {
    const rules = deferred<FormattedRule[]>();
    api.getGroupRulesForGroup.mockReturnValue(rules.promise);

    const { result } = renderHook(() => useGroupSource(1));

    await act(async () => {
      result.current.open(GROUP_A);
    });
    expect(result.current.rulesStatus).toBe('loading');

    await act(async () => {
      rules.resolve([RULE_A]);
      await flush();
    });

    expect(result.current.rulesStatus).toBe('done');
    expect(result.current.feedingRules).toEqual([
      { id: RULE_A.id, name: RULE_A.name, status: RULE_A.status },
    ]);
  });

  it('drops a rules payload that resolves after the user switched groups', async () => {
    const alpha = deferred<FormattedRule[]>();
    const bravo = deferred<FormattedRule[]>();
    api.getGroupRulesForGroup.mockReturnValueOnce(alpha.promise).mockReturnValueOnce(bravo.promise);

    const { result } = renderHook(() => useGroupSource(1));

    // Alpha's read is still in flight when the user opens Bravo, which bumps the
    // run id — so Alpha's late payload belongs to a superseded run.
    await act(async () => {
      result.current.open(GROUP_A);
    });
    await act(async () => {
      result.current.open(GROUP_B);
    });

    await act(async () => {
      bravo.resolve([RULE_B]);
      await flush();
    });
    await act(async () => {
      alpha.resolve([RULE_A]);
      await flush();
    });

    expect(result.current.group).toEqual(GROUP_B);
    expect(result.current.feedingRules).toEqual([
      { id: RULE_B.id, name: RULE_B.name, status: RULE_B.status },
    ]);
    expect(result.current.feedingRules.map((r) => r.id)).not.toContain(RULE_A.id);
  });

  it('surfaces a rules failure that belongs to the current run', async () => {
    const rules = deferred<FormattedRule[]>();
    api.getGroupRulesForGroup.mockReturnValue(rules.promise);

    const { result } = renderHook(() => useGroupSource(1));

    await act(async () => {
      result.current.open(GROUP_A);
    });
    await act(async () => {
      rules.reject(new Error('Rules read failed'));
      await flush();
    });

    expect(result.current.rulesStatus).toBe('error');
    expect(result.current.error).toBe('Rules read failed');
  });

  it('drops a rules failure that lands after the insight was closed', async () => {
    const rules = deferred<FormattedRule[]>();
    api.getGroupRulesForGroup.mockReturnValue(rules.promise);

    const { result } = renderHook(() => useGroupSource(1));

    await act(async () => {
      result.current.open(GROUP_A);
    });
    await act(async () => {
      result.current.close();
    });

    await act(async () => {
      rules.reject(new Error('Rules read failed'));
      await flush();
    });

    // A closed insight must not pop back into an error state for a group the
    // user has already navigated away from.
    expect(result.current.rulesStatus).toBe('idle');
    expect(result.current.error).toBeNull();
    expect(result.current.group).toBeNull();
  });
});

describe('useGroupSource analyzeMembers() stale-run guard', () => {
  /** Open GROUP_A with its rules already settled, ready for an analysis. */
  async function openSettled(result: { current: ReturnType<typeof useGroupSource> }) {
    await act(async () => {
      result.current.open(GROUP_A);
    });
    await waitFor(() => expect(result.current.rulesStatus).toBe('done'));
  }

  it('applies and banks a breakdown that belongs to the current run', async () => {
    api.getGroupRulesForGroup.mockResolvedValue([RULE_A]);
    const members = deferred<OktaUser[]>();
    api.getAllGroupMembers.mockReturnValue(members.promise);

    const { result } = renderHook(() => useGroupSource(1));
    await openSettled(result);

    await act(async () => {
      result.current.analyzeMembers();
    });
    expect(result.current.memberStatus).toBe('loading');

    await act(async () => {
      members.resolve(MEMBERS);
      await flush();
    });

    expect(result.current.memberStatus).toBe('done');
    expect(result.current.breakdown?.total).toBe(MEMBERS.length);
    expect(readMemberSource(GROUP_A.id)?.total).toBe(MEMBERS.length);
  });

  it('drops a member walk that resolves after the insight was closed', async () => {
    api.getGroupRulesForGroup.mockResolvedValue([RULE_A]);
    const members = deferred<OktaUser[]>();
    api.getAllGroupMembers.mockReturnValue(members.promise);

    const { result } = renderHook(() => useGroupSource(1));
    await openSettled(result);

    await act(async () => {
      result.current.analyzeMembers();
    });
    expect(api.getAllGroupMembers).toHaveBeenCalledWith(GROUP_A.id);

    // Closed mid-walk: the run id moves on while the member read is in flight.
    await act(async () => {
      result.current.close();
    });
    await act(async () => {
      members.resolve(MEMBERS);
      await flush();
    });

    expect(result.current.memberStatus).toBe('idle');
    expect(result.current.breakdown).toBeNull();
    // Nothing may be banked either — the groups list reads that cache directly,
    // so a stale write would surface a split for a closed analysis.
    expect(readMemberSource(GROUP_A.id)).toBeNull();
  });

  it('surfaces a member-walk failure that belongs to the current run', async () => {
    api.getGroupRulesForGroup.mockResolvedValue([RULE_A]);
    const members = deferred<OktaUser[]>();
    api.getAllGroupMembers.mockReturnValue(members.promise);

    const { result } = renderHook(() => useGroupSource(1));
    await openSettled(result);

    await act(async () => {
      result.current.analyzeMembers();
    });
    await act(async () => {
      members.reject(new Error('Member walk failed'));
      await flush();
    });

    expect(result.current.memberStatus).toBe('error');
    expect(result.current.error).toBe('Member walk failed');
  });

  it('drops a member-walk failure that lands after the insight was closed', async () => {
    api.getGroupRulesForGroup.mockResolvedValue([RULE_A]);
    const members = deferred<OktaUser[]>();
    api.getAllGroupMembers.mockReturnValue(members.promise);

    const { result } = renderHook(() => useGroupSource(1));
    await openSettled(result);

    await act(async () => {
      result.current.analyzeMembers();
    });
    await act(async () => {
      result.current.close();
    });
    await act(async () => {
      members.reject(new Error('Member walk failed'));
      await flush();
    });

    expect(result.current.memberStatus).toBe('idle');
    expect(result.current.error).toBeNull();
  });
});

describe('useGroupSource resummarize() no-group guard', () => {
  it('recomputes while a group is open, and stops once it is closed', async () => {
    api.getGroupRulesForGroup.mockResolvedValue([RULE_A]);
    api.getAllGroupMembers.mockResolvedValue(MEMBERS);

    const { result } = renderHook(() => useGroupSource(1));

    await act(async () => {
      result.current.open(GROUP_A);
    });
    await waitFor(() => expect(result.current.rulesStatus).toBe('done'));
    await act(async () => {
      result.current.analyzeMembers();
    });
    await waitFor(() => expect(result.current.memberStatus).toBe('done'));

    // Guard false on both operands: a group is open and the last analysis's
    // rules are in hand, so the recompute lands.
    await act(async () => {
      result.current.resummarize([makeMember(0)]);
    });
    expect(result.current.breakdown?.total).toBe(1);
    expect(readMemberSource(GROUP_A.id)?.total).toBe(1);

    await act(async () => {
      result.current.close();
    });

    // Guard true via `!group`: a late roster change from the view being torn down
    // must neither resurrect a breakdown nor rewrite the banked split.
    await act(async () => {
      result.current.resummarize([makeMember(0), makeMember(1), makeMember(2)]);
    });

    expect(result.current.breakdown).toBeNull();
    expect(readMemberSource(GROUP_A.id)?.total).toBe(1);
  });

  it('is a no-op before anything has been opened', async () => {
    const { result } = renderHook(() => useGroupSource(1));

    await act(async () => {
      result.current.resummarize(MEMBERS);
    });

    expect(result.current.breakdown).toBeNull();
    expect(api.getGroupRulesForGroup).not.toHaveBeenCalled();
    expect(api.getAllGroupMembers).not.toHaveBeenCalled();
  });
});
