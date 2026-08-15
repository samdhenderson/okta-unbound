/**
 * Guardrail: the group-source analysis must never fan out per member.
 *
 * `useGroupSource.analyzeMembers` answers "manual vs rule-managed" from exactly
 * two inputs — one paginated member listing and the org-wide rules payload — so
 * its scheduler cost is `ceil(N / OKTA_PAGE_SIZE)` plus a constant, and the
 * constant must stay constant as N grows. This pins that shape so a later
 * change (an Okta `expand` parameter on the member read, a member cache in front
 * of it) is provably free of new per-member traffic.
 *
 * Counting happens at the **scheduler/transport boundary** — the
 * `chrome.runtime.sendMessage({ action: 'scheduleApiRequest' })` that
 * `coreApi.makeApiRequest` posts to the background `ApiScheduler` — not at
 * `fetch`. That is the boundary the ADRs care about: bypassing the scheduler is
 * itself the violation, so a request that never reaches this mock is a bug, not
 * a saving. (Same counting technique as
 * `useOktaApi/core.makeApiRequest.test.ts`'s `scheduleCallCount`.)
 *
 * Precedents this test generalizes:
 * - `useOktaApi/ruleImpact.ts:7-9` and `:131-133` — "no per-member API calls";
 *   the "who loses access" answer comes from rules metadata plus the members
 *   already fetched.
 * - `useUserMemberships.ts:143-146` — membership analysis matches on ids,
 *   expressions and attributes only, so the per-referenced-group name fan-out is
 *   deliberately skipped.
 * - `fetchGroupRulesRequest.test.ts:85-86` — "Never fans out to resolve the
 *   unknown id."
 *
 * The one sanctioned fan-out in the app — `MemberExplorer.tsx:334-337`'s MFA
 * scan, "roughly one API call per member" — is gated behind an explicit
 * confirmation modal that states the cost. That is the bar any future fan-out
 * has to clear; nothing on this path may fan out silently.
 *
 * Fixtures use only fake placeholders (`00gFAKE…`, `00uFAKE…`, `example.com`)
 * per CLAUDE.md.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGroupSource } from './useGroupSource';
import { OKTA_PAGE_SIZE } from '../../shared/utils/oktaPagination';
import { setEntry, resetEntityCache } from '../cache/entityCache';
import type { GroupSummary, OktaGroupRule, OktaUser } from '../../shared/types';

const runtimeSendMessage = chrome.runtime.sendMessage as ReturnType<typeof vi.fn>;
const storageGet = chrome.storage.local.get as ReturnType<typeof vi.fn>;
const storageSet = chrome.storage.local.set as ReturnType<typeof vi.fn>;
const storageRemove = chrome.storage.local.remove as ReturnType<typeof vi.fn>;

const GROUP_ID = '00gFAKEGROUP1';
/** Obviously fake origin; only `pathname + search` is ever read back out of it. */
const FAKE_ORIGIN = 'https://okta-unbound-fake.example';

const group: GroupSummary = {
  id: GROUP_ID,
  name: 'Fake Engineering',
  type: 'OKTA_GROUP',
  memberCount: 0,
  hasRules: true,
  ruleCount: 1,
};

/** One feeding rule targeting the group — the whole org-wide rules payload. */
const feedingRule: OktaGroupRule = {
  id: '0prFAKERULE1',
  name: 'Engineering feeder',
  status: 'ACTIVE',
  type: 'group_rule',
  created: '2020-01-01T00:00:00.000Z',
  lastUpdated: '2024-01-01T00:00:00.000Z',
  conditions: {
    expression: { value: 'user.department == "Engineering"', type: 'urn:okta:expression:1.0' },
  },
  actions: { assignUserToGroups: { groupIds: [GROUP_ID] } },
};

/**
 * A schema-valid group member row.
 *
 * `status` is a literal rather than a widened `string` so the same fixture serves
 * both roles it plays here: a raw API payload, and a typed `OktaUser[]` handed
 * straight to `resummarize`.
 */
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

/** One page of members, with a `rel="next"` Link header while more remain. */
function memberPage(url: string, total: number) {
  const params = new URLSearchParams(url.split('?')[1] ?? '');
  const start = Number(params.get('after') ?? '0');
  const end = Math.min(start + OKTA_PAGE_SIZE, total);
  const data = [];
  for (let i = start; i < end; i++) data.push(makeMember(i));

  const headers: Record<string, string> = {};
  if (end < total) {
    headers.link =
      `<${FAKE_ORIGIN}/api/v1/groups/${GROUP_ID}/users` +
      `?limit=${OKTA_PAGE_SIZE}&after=${end}>; rel="next"`;
  }
  return { success: true, data, headers };
}

/**
 * Install a stateful `chrome.storage.local` stub plus a scheduler transport that
 * serves the org rules listing and `memberCount` members.
 *
 * The storage stub is stateful on purpose: `RulesCache` really does write back
 * the org-wide rules payload it fetches, so a no-op storage mock would invent a
 * second rules read that production never makes.
 */
function installHarness(memberCount: number) {
  // Reset first: a test that runs two cycles must count each one on its own.
  // That now includes the module-level entity cache, which banks the member walk
  // under `['groupMembers', groupId]` — without this reset a second cycle in the
  // same test would be served the FIRST cycle's member list (see the warm-cache
  // case below, which opts into that behaviour deliberately). The global
  // `afterEach` in `src/test/setup.ts` only resets it between tests.
  resetEntityCache();
  runtimeSendMessage.mockReset();
  storageGet.mockReset();
  storageSet.mockReset();
  storageRemove.mockReset();

  const storage = new Map<string, unknown>();
  storageGet.mockImplementation(async (key: string) =>
    storage.has(key) ? { [key]: storage.get(key) } : {},
  );
  storageSet.mockImplementation(async (items: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(items)) storage.set(key, value);
  });
  storageRemove.mockImplementation(async (key: string) => {
    storage.delete(key);
  });

  runtimeSendMessage.mockImplementation(async (message: { action?: string; endpoint?: string }) => {
    if (message?.action !== 'scheduleApiRequest') return { success: true };
    const endpoint = message.endpoint ?? '';
    if (endpoint.startsWith('/api/v1/groups/rules')) {
      return { success: true, data: [feedingRule], headers: {} };
    }
    if (endpoint.startsWith(`/api/v1/groups/${GROUP_ID}/users`)) {
      return memberPage(endpoint, memberCount);
    }
    throw new Error(`Unrouted test endpoint: ${endpoint}`);
  });
}

/** Every endpoint put on the scheduler, in call order. */
function scheduledEndpoints(): string[] {
  return runtimeSendMessage.mock.calls
    .filter((call) => call[0]?.action === 'scheduleApiRequest')
    .map((call) => String(call[0]?.endpoint ?? ''));
}

/**
 * Drive one full open → analyze cycle against a group of `memberCount` members.
 *
 * @returns Every endpoint scheduled across the whole cycle, in order.
 */
async function runOpenAndAnalyze(memberCount: number): Promise<string[]> {
  installHarness(memberCount);

  const { result } = renderHook(() => useGroupSource(1));

  await act(async () => {
    result.current.open(group);
  });
  await waitFor(() => expect(result.current.rulesStatus).toBe('done'));

  await act(async () => {
    result.current.analyzeMembers();
  });
  await waitFor(() => expect(result.current.memberStatus).toBe('done'));

  expect(result.current.breakdown?.total).toBe(memberCount);
  return scheduledEndpoints();
}

/**
 * The non-member term, measured (not guessed) against the current code.
 *
 * Derivation: `open()` calls `getGroupRulesForGroup`, which misses the cold
 * `RulesCache` and issues ONE paginated `/api/v1/groups/rules?limit=200`
 * listing for the whole org, then writes it back. `analyzeMembers()` calls
 * `getGroupRulesForGroup` again, and that second read is served entirely from
 * the now-warm cache — zero requests. So the constant is 1 for the whole cycle,
 * regardless of how many members or rules the org has.
 */
const RULES_LISTING_REQUESTS = 1;

beforeEach(() => {
  runtimeSendMessage.mockReset();
  storageGet.mockReset();
  storageSet.mockReset();
  storageRemove.mockReset();
  // A 2000-member walk emits several debug lines per member (membershipAnalysis,
  // entityCache); silence the dev-only levels so the run stays readable. warn and
  // error still surface.
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useGroupSource scheduler cost', () => {
  it.each([50, 500, 2000])(
    'costs ceil(N/200) member pages plus a constant rules read for N=%i members',
    async (memberCount) => {
      const endpoints = await runOpenAndAnalyze(memberCount);

      const memberPages = endpoints.filter((e) => e.startsWith(`/api/v1/groups/${GROUP_ID}/users`));
      const rulesListings = endpoints.filter((e) => e.startsWith('/api/v1/groups/rules'));

      expect(memberPages).toHaveLength(Math.ceil(memberCount / OKTA_PAGE_SIZE));
      expect(rulesListings).toHaveLength(RULES_LISTING_REQUESTS);
      expect(endpoints).toHaveLength(
        Math.ceil(memberCount / OKTA_PAGE_SIZE) + RULES_LISTING_REQUESTS,
      );
    },
  );

  // The load-bearing assertion. It holds no matter what the absolute numbers
  // become: only a term that grows with N can break it, which is exactly the
  // per-member fan-out this file exists to forbid.
  it('scales ONLY with the member page count — the non-member term is constant in N', async () => {
    const small = (await runOpenAndAnalyze(50)).length;
    const large = (await runOpenAndAnalyze(2000)).length;

    expect(large - small).toBe(Math.ceil(2000 / OKTA_PAGE_SIZE) - Math.ceil(50 / OKTA_PAGE_SIZE));
  });

  it.each([50, 500, 2000])(
    'never issues a per-member /api/v1/users/{id} request for N=%i members',
    async (memberCount) => {
      const endpoints = await runOpenAndAnalyze(memberCount);

      // The fan-out shape: one GET per member (`/api/v1/users/{id}`, or
      // `/api/v1/users/{id}/groups`). It must never appear on this path.
      expect(endpoints.filter((e) => /^\/api\/v1\/users\//.test(e))).toEqual([]);
    },
  );
});

/**
 * Drive open → analyze against the harness already installed by the caller, so a
 * test can seed the entity cache (or fire two analyses) in between.
 *
 * @param onOpened - Optional hook run after `open()` settles and before the
 *   analysis, used by the de-duplication case to fire two analyses at once.
 * @returns The rendered hook result, once `memberStatus` is `done`.
 */
async function openAndAnalyze(
  onOpened?: (analyze: () => void) => void,
): Promise<ReturnType<typeof renderHook<ReturnType<typeof useGroupSource>, unknown>>['result']> {
  const { result } = renderHook(() => useGroupSource(1));

  await act(async () => {
    result.current.open(group);
  });
  await waitFor(() => expect(result.current.rulesStatus).toBe('done'));

  await act(async () => {
    if (onOpened) onOpened(result.current.analyzeMembers);
    else result.current.analyzeMembers();
  });
  await waitFor(() => expect(result.current.memberStatus).toBe('done'));

  return result;
}

/** Every member-listing endpoint scheduled so far. */
function memberPageEndpoints(): string[] {
  return scheduledEndpoints().filter((e) => e.startsWith(`/api/v1/groups/${GROUP_ID}/users`));
}

describe('useGroupSource entity-cache reuse', () => {
  const MEMBER_COUNT = 500;

  it('costs ZERO member requests when ["groupMembers", id] is already banked', async () => {
    installHarness(MEMBER_COUNT);
    // Bank the member list exactly as any earlier consumer would — the same key
    // and the same `OktaUser[]` shape `useGroupMembersCache.fetchMembers` and
    // `GroupOverview` write. Re-opening this group's analysis must then read
    // memory, not re-walk every page.
    const banked = Array.from({ length: MEMBER_COUNT }, (_, i) => makeMember(i));
    setEntry(['groupMembers', GROUP_ID], banked);

    const result = await openAndAnalyze();

    expect(result.current.breakdown?.total).toBe(MEMBER_COUNT);
    // The member walk contributes nothing; only the rules read remains.
    expect(memberPageEndpoints()).toEqual([]);
    expect(scheduledEndpoints()).toHaveLength(RULES_LISTING_REQUESTS);
  });

  it('coalesces two concurrent analyses of the same group onto ONE member walk', async () => {
    installHarness(MEMBER_COUNT);

    const result = await openAndAnalyze((analyze) => {
      // Both start before either resolves: `getOrFetch` must hand the second
      // caller the first one's in-flight promise rather than start a second walk.
      analyze();
      analyze();
    });

    expect(result.current.breakdown?.total).toBe(MEMBER_COUNT);
    expect(memberPageEndpoints()).toHaveLength(Math.ceil(MEMBER_COUNT / OKTA_PAGE_SIZE));
  });
});

/**
 * `resummarize` corrects the split after a membership write **without touching
 * Okta**, which is the only reason it can be called on every add/remove.
 *
 * It exists because `breakdown` is React state: the cache invalidation that rides
 * every membership write fixes the *next* read, but the meter rendered directly
 * above the Members section would keep showing pre-mutation counts for as long as
 * the view stayed mounted. The rules from the last analysis are still in hand and
 * `summarizeMemberSources` is pure, so the honest answer costs nothing.
 */
describe('useGroupSource.resummarize', () => {
  it('re-splits a changed roster without scheduling a single request', async () => {
    installHarness(3);
    const { result } = renderHook(() => useGroupSource(1));

    await act(async () => {
      result.current.open(group);
    });
    await waitFor(() => expect(result.current.rulesStatus).toBe('done'));
    await act(async () => {
      result.current.analyzeMembers();
    });
    await waitFor(() => expect(result.current.memberStatus).toBe('done'));
    expect(result.current.breakdown?.total).toBe(3);

    const before = scheduledEndpoints().length;

    // One member removed, as the Members section would report it.
    await act(async () => {
      result.current.resummarize([makeMember(0), makeMember(1)]);
    });

    expect(result.current.breakdown?.total).toBe(2);
    expect(scheduledEndpoints()).toHaveLength(before);
  });

  it('is a no-op before an analysis has run, since there is no split to correct', async () => {
    installHarness(3);
    const { result } = renderHook(() => useGroupSource(1));

    await act(async () => {
      result.current.open(group);
    });
    await waitFor(() => expect(result.current.rulesStatus).toBe('done'));

    await act(async () => {
      result.current.resummarize([makeMember(0)]);
    });

    expect(result.current.breakdown).toBeNull();
    expect(result.current.memberStatus).toBe('idle');
  });
});
