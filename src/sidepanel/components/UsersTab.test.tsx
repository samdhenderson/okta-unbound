/**
 * CHARACTERIZATION TESTS for UsersTab.
 *
 * These pin the behavior of UsersTab **as it exists today**, ahead of its §7
 * decomposition. Several assertions deliberately encode behavior that is arguably
 * a bug (the <2-char branch that does not clear results, the merged single `error`
 * channel, the in-file membership heuristic that ignores rule exclusion lists).
 * Do NOT "fix" a test here — if the behavior should change, change it in its own
 * commit and flip the matching assertion there.
 *
 * Harness: UsersTab's READ path (searchUsers / getUserDetails / getUserGroups /
 * fetchGroupRules) uses raw `chrome.tabs.sendMessage` and bypasses the scheduler,
 * so MSW does not apply. Its WRITE path (suspend / unsuspend / resetPassword /
 * getUserById / searchGroups / addUserToGroup) goes through the REAL `useOktaApi`
 * → `chrome.runtime.sendMessage({ action: 'scheduleApiRequest', endpoint })`. We
 * mock both chrome messaging surfaces (exactly as `GroupsTab.test.tsx` /
 * `hooks/useOktaApi.test.ts` do) and drive the real hook so scheduler traffic and
 * the memoized-identity fix (commit 6863313) are both observable.
 *
 * Timer discipline: fake ONLY `setTimeout`/`clearTimeout` — vitest's default set
 * also stubs queueMicrotask/nextTick, which deadlocks Testing Library's async
 * wrapper (this is what hung the session-4 suite). Debounce tests drive the input
 * with synchronous `fireEvent`; async-only tests use real timers + `findBy`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import UsersTab from './UsersTab';

// ---------------------------------------------------------------------------
// Hook / module test doubles
// ---------------------------------------------------------------------------
const userContext = vi.hoisted(() => ({
  current: { userInfo: null, isLoading: false, oktaOrigin: null } as {
    userInfo: { userId: string; userName: string; userStatus?: string } | null;
    isLoading: boolean;
    oktaOrigin: string | null;
  },
}));

vi.mock('../hooks/useUserContext', () => ({
  useUserContext: () => userContext.current,
}));

// RulesCache is chrome.storage-backed; stub it so membership analysis is driven
// purely by fixtures. Default: cache miss (forces the fetchGroupRules round-trip).
const rulesCacheGet = vi.hoisted(() => vi.fn());
const rulesCacheSet = vi.hoisted(() => vi.fn());
vi.mock('../../shared/rulesCache', () => ({
  RulesCache: { get: rulesCacheGet, set: rulesCacheSet },
}));

// addUserToGroup logs an undo action on success.
vi.mock('../../shared/undoManager', () => ({
  logAction: vi.fn(),
  logBulkRemoveAction: vi.fn(),
  logBulkAddAction: vi.fn(),
}));

// ---------------------------------------------------------------------------
// chrome mocks
// ---------------------------------------------------------------------------
const runtimeSendMessage = vi.fn();
const tabsSendMessage = vi.fn();

globalThis.chrome = {
  runtime: {
    sendMessage: runtimeSendMessage,
    getURL: (p: string) => p,
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  tabs: { sendMessage: tabsSendMessage },
  storage: { local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } },
} as any;

// The scheduler (runtime.sendMessage) endpoint router used by the real useOktaApi.
type Route = [RegExp, (msg: any) => any];
let routes: Route[] = [];
function route(pattern: RegExp, respond: (msg: any) => any) {
  routes.push([pattern, respond]);
}

// The content-script (tabs.sendMessage) action router used by UsersTab directly.
let tabResponders: Record<string, (msg: any) => any> = {};
function tabRoute(action: string, respond: (msg: any) => any) {
  tabResponders[action] = respond;
}

function tabCalls(action?: string) {
  return tabsSendMessage.mock.calls
    .map((c) => c[1])
    .filter((m) => (action ? m.action === action : true));
}

function schedulerEndpoints() {
  return runtimeSendMessage.mock.calls.map((c) => c[0].endpoint).filter(Boolean);
}

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------
function oktaUser(over: Record<string, any> = {}) {
  const { profile, ...rest } = over;
  return {
    id: 'u1',
    status: 'ACTIVE',
    created: '2020-01-01T00:00:00.000Z',
    lastLogin: '2024-01-01T00:00:00.000Z',
    ...rest,
    profile: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@x.com',
      login: 'ada@x.com',
      department: 'Engineering',
      ...(profile ?? {}),
    },
  };
}

function rawGroup(over: Record<string, any> = {}) {
  return {
    id: 'g1',
    type: 'OKTA_GROUP',
    profile: { name: 'Engineering', description: 'Eng team' },
    ...over,
  };
}

function activeRule(over: Record<string, any> = {}) {
  return {
    id: 'r1',
    name: 'Eng auto-assign',
    status: 'ACTIVE',
    groupIds: ['g1'],
    conditions: { expression: { value: 'user.department == "Engineering"' } },
    ...over,
  };
}

// ---------------------------------------------------------------------------
// timer helpers (mirrors GroupsTab.test.tsx)
// ---------------------------------------------------------------------------
function useDebounceTimers() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
}

function setValue(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

function typeInto(input: HTMLElement, text: string) {
  let acc = (input as HTMLInputElement).value;
  for (const ch of text) {
    acc += ch;
    fireEvent.change(input, { target: { value: acc } });
  }
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

/** Flush pending microtasks (promise chains) with no timer advance. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

const userSearchInput = () => screen.getByPlaceholderText('Search by email, name, or login...');
const groupSearchInput = () => screen.getByPlaceholderText('Type to search by group name...');

beforeEach(() => {
  vi.clearAllMocks();
  routes = [];
  tabResponders = {};
  userContext.current = { userInfo: null, isLoading: false, oktaOrigin: null };

  // sensible defaults; individual tests override.
  tabRoute('searchUsers', () => ({ success: true, data: [] }));
  tabRoute('getUserGroups', () => ({ success: true, data: [] }));
  tabRoute('fetchGroupRules', () => ({ success: true, rules: [], stats: {}, conflicts: [] }));
  tabRoute('getUserDetails', () => ({ success: true, data: oktaUser() }));

  tabsSendMessage.mockImplementation(async (_tabId: number, msg: any) => {
    const r = tabResponders[msg.action];
    return r ? r(msg) : { success: false, error: `unhandled action ${msg.action}` };
  });

  rulesCacheGet.mockResolvedValue(null); // cache miss by default
  rulesCacheSet.mockResolvedValue(undefined);

  runtimeSendMessage.mockImplementation(async (msg: any) => {
    if (msg.action !== 'scheduleApiRequest') return { success: false };
    for (const [pattern, respond] of routes) {
      if (pattern.test(msg.endpoint)) return respond(msg);
    }
    return { success: false, error: `unrouted endpoint: ${msg.endpoint}` };
  });
});

afterEach(() => {
  vi.useRealTimers();
});

// ===========================================================================
// 1. User-search debounce (600ms, min 2 chars) — bounded sendMessage traffic.
//    A handleSearch identity regression here fails silently (search stops).
// ===========================================================================
describe('user search: 600ms debounce contract', () => {
  it('fires exactly one searchUsers message 600ms after the last keystroke', async () => {
    useDebounceTimers();
    render(<UsersTab targetTabId={1} />);
    tabsSendMessage.mockClear();

    typeInto(userSearchInput(), 'ada');

    await advance(599);
    expect(tabCalls('searchUsers')).toHaveLength(0);

    await advance(1);
    expect(tabCalls('searchUsers')).toHaveLength(1);
    expect(tabsSendMessage).toHaveBeenCalledWith(1, { action: 'searchUsers', query: 'ada' });
  });

  it('restarts the 600ms window on every keystroke (only one call fires)', async () => {
    useDebounceTimers();
    render(<UsersTab targetTabId={1} />);
    tabsSendMessage.mockClear();
    const input = userSearchInput();

    setValue(input, 'ad');
    await advance(500);
    setValue(input, 'ada');
    await advance(500);
    expect(tabCalls('searchUsers')).toHaveLength(0);

    await advance(100);
    expect(tabCalls('searchUsers')).toHaveLength(1);
    expect(tabsSendMessage).toHaveBeenCalledWith(1, { action: 'searchUsers', query: 'ada' });
  });

  it('does not search for queries shorter than 2 characters', async () => {
    useDebounceTimers();
    render(<UsersTab targetTabId={1} />);
    tabsSendMessage.mockClear();

    typeInto(userSearchInput(), 'a');
    await advance(1000);

    expect(tabCalls('searchUsers')).toHaveLength(0);
  });

  it('still fires exactly once when unrelated re-renders happen mid-debounce', async () => {
    useDebounceTimers();
    const { rerender } = render(<UsersTab targetTabId={1} currentGroupId="x0" />);
    tabsSendMessage.mockClear();

    typeInto(userSearchInput(), 'ada');

    // Prop identity churn that must NOT reschedule the debounce timer. If
    // handleSearch loses its memoized identity the effect re-runs forever.
    for (let i = 0; i < 5; i++) {
      rerender(<UsersTab targetTabId={1} currentGroupId={`x${i}`} onNavigateToRule={() => {}} />);
      await advance(50);
    }
    await advance(600);

    expect(tabCalls('searchUsers')).toHaveLength(1);
    expect(tabsSendMessage).toHaveBeenCalledWith(1, { action: 'searchUsers', query: 'ada' });
  });

  it('re-searches when targetTabId changes', async () => {
    useDebounceTimers();
    const { rerender } = render(<UsersTab targetTabId={1} />);
    typeInto(userSearchInput(), 'ada');
    await advance(600);
    tabsSendMessage.mockClear();

    rerender(<UsersTab targetTabId={2} />);
    await advance(600);

    expect(tabCalls('searchUsers')).toHaveLength(1);
    expect(tabsSendMessage).toHaveBeenCalledWith(2, { action: 'searchUsers', query: 'ada' });
  });

  it('CHARACTERIZED (quirk): backspacing to 1 char leaves stale results on screen', async () => {
    useDebounceTimers();
    tabRoute('searchUsers', () => ({
      success: true,
      data: [oktaUser({ id: 'u9', profile: { firstName: 'Grace', lastName: 'Hopper' } })],
    }));
    render(<UsersTab targetTabId={1} />);
    const input = userSearchInput();

    typeInto(input, 'gra');
    await advance(600);
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();

    tabsSendMessage.mockClear();
    setValue(input, 'g'); // <2 chars: early-returns WITHOUT clearing searchResults
    await advance(1000);

    expect(tabCalls('searchUsers')).toHaveLength(0);
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();

    setValue(input, ''); // only reaching 0 chars clears the results
    await advance(0);
    expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument();
  });

  it('never routes user search through the background scheduler (the §8 bypass)', async () => {
    useDebounceTimers();
    render(<UsersTab targetTabId={1} />);
    runtimeSendMessage.mockClear();

    typeInto(userSearchInput(), 'ada');
    await advance(600);

    expect(schedulerEndpoints()).not.toContain('/api/v1/users');
    expect(runtimeSendMessage).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 2. Detected-user banner: MANUAL load only. The tab is never hijacked by admin
//    navigation — it stays pinned to the explicitly selected user.
// ===========================================================================
describe('detected user: manual-load banner', () => {
  const detected = {
    userInfo: { userId: 'u1', userName: 'Ada Lovelace', userStatus: 'ACTIVE' },
    isLoading: false,
    oktaOrigin: null,
  };

  it('does NOT auto-fetch; shows a banner and loads only when Load is clicked', async () => {
    userContext.current = { ...detected };
    render(<UsersTab targetTabId={1} />);

    // No fetch on detection — the banner is shown instead.
    expect(tabCalls('getUserDetails')).toHaveLength(0);
    expect(screen.getByText(/Detected in admin/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    });

    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(tabCalls('getUserDetails')).toHaveLength(1);
    expect(tabCalls('getUserGroups')).toHaveLength(1);
  });

  it('never auto-fetches across parent re-renders', async () => {
    userContext.current = { ...detected };
    const { rerender } = render(<UsersTab targetTabId={1} currentGroupId="a" />);

    for (let i = 0; i < 3; i++) {
      rerender(<UsersTab targetTabId={1} currentGroupId={`b${i}`} onNavigateToRule={() => {}} />);
      await flush();
    }

    expect(tabCalls('getUserDetails')).toHaveLength(0);
    expect(screen.getByText(/Detected in admin/)).toBeInTheDocument();
  });

  it('surfaces an error when a manual Load fails', async () => {
    userContext.current = {
      userInfo: { userId: 'u1', userName: 'Ada Lovelace' },
      isLoading: false,
      oktaOrigin: null,
    };
    tabRoute('getUserDetails', () => ({ success: false, error: 'boom' }));
    render(<UsersTab targetTabId={1} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    });

    expect(await screen.findByText('boom')).toBeInTheDocument();
  });

  it('Dismiss hides the banner without any fetch', async () => {
    userContext.current = { ...detected };
    render(<UsersTab targetTabId={1} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    });

    expect(screen.queryByText(/Detected in admin/)).not.toBeInTheDocument();
    expect(tabCalls('getUserDetails')).toHaveLength(0);
  });
});

// ===========================================================================
// 3. Manual user selection → membership analysis (in-file heuristic, AS-IS).
// ===========================================================================
describe('membership classification (in-file heuristic)', () => {
  beforeEach(() => {
    tabRoute('searchUsers', () => ({ success: true, data: [oktaUser()] }));
  });

  it('classifies an APP_GROUP as RULE_BASED regardless of rules', async () => {
    tabRoute('getUserGroups', () => ({
      success: true,
      data: [rawGroup({ id: 'g2', type: 'APP_GROUP', profile: { name: 'Salesforce' } })],
    }));
    rulesCacheGet.mockResolvedValue({ rules: [] });

    render(<UsersTab targetTabId={1} />);
    // real-timer search (600ms) drives selection
    fireEvent.change(userSearchInput(), { target: { value: 'ada' } });
    const card = await screen.findByText('Ada Lovelace', {}, { timeout: 2000 });
    fireEvent.click(card);

    expect(await screen.findByText('Salesforce')).toBeInTheDocument();
    expect(screen.getByText('RULE BASED')).toBeInTheDocument();
  });

  it('classifies a group with a matching ACTIVE rule as RULE_BASED and shows the rule', async () => {
    tabRoute('getUserGroups', () => ({ success: true, data: [rawGroup()] }));
    rulesCacheGet.mockResolvedValue({ rules: [activeRule()] });

    render(<UsersTab targetTabId={1} />);
    fireEvent.change(userSearchInput(), { target: { value: 'ada' } });
    fireEvent.click(await screen.findByText('Ada Lovelace', {}, { timeout: 2000 }));

    expect(await screen.findByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('RULE BASED')).toBeInTheDocument();
    expect(screen.getByText('Eng auto-assign')).toBeInTheDocument();
  });

  it('classifies a group with no active rules as DIRECT', async () => {
    tabRoute('getUserGroups', () => ({ success: true, data: [rawGroup()] }));
    rulesCacheGet.mockResolvedValue({ rules: [] });

    render(<UsersTab targetTabId={1} />);
    fireEvent.change(userSearchInput(), { target: { value: 'ada' } });
    fireEvent.click(await screen.findByText('Ada Lovelace', {}, { timeout: 2000 }));

    expect(await screen.findByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('DIRECT')).toBeInTheDocument();
    expect(
      screen.getByText('This user was added directly to the group (not through a rule)'),
    ).toBeInTheDocument();
  });

  it('classifies an excluded user as DIRECT even when an active rule targets the group', async () => {
    // Behavior adopted from useUserMemberships: a user on the exclusion list of
    // every matching rule is a manual add (DIRECT), not RULE_BASED.
    tabRoute('getUserGroups', () => ({ success: true, data: [rawGroup()] }));
    rulesCacheGet.mockResolvedValue({
      rules: [activeRule({ conditions: { people: { users: { exclude: ['u1'] } } } })],
    });

    render(<UsersTab targetTabId={1} />);
    fireEvent.change(userSearchInput(), { target: { value: 'ada' } });
    fireEvent.click(await screen.findByText('Ada Lovelace', {}, { timeout: 2000 }));

    expect(await screen.findByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('DIRECT')).toBeInTheDocument();
    expect(screen.queryByText('Eng auto-assign')).not.toBeInTheDocument();
  });

  it('CHARACTERIZED: degrades to all-DIRECT (no error) when rules cannot be fetched', async () => {
    tabRoute('getUserGroups', () => ({ success: true, data: [rawGroup()] }));
    rulesCacheGet.mockResolvedValue(null);
    tabRoute('fetchGroupRules', () => ({ success: false, error: 'nope' }));

    render(<UsersTab targetTabId={1} />);
    fireEvent.change(userSearchInput(), { target: { value: 'ada' } });
    fireEvent.click(await screen.findByText('Ada Lovelace', {}, { timeout: 2000 }));

    expect(await screen.findByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('DIRECT')).toBeInTheDocument();
    // the rules-fetch failure is swallowed — no error banner.
    expect(screen.queryByText('nope')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 4. Lifecycle confirm flow (real useOktaApi → scheduler).
// ===========================================================================
describe('lifecycle actions', () => {
  async function renderWithActiveUser() {
    userContext.current = {
      userInfo: { userId: 'u1', userName: 'Ada Lovelace', userStatus: 'ACTIVE' },
      isLoading: false,
      oktaOrigin: null,
    };
    tabRoute('getUserGroups', () => ({ success: true, data: [] }));
    render(<UsersTab targetTabId={1} />);
    // Load the detected user via the banner (no auto-load).
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    });
    await screen.findByRole('heading', { name: 'Ada Lovelace' });
  }

  it('suspends an ACTIVE user: exact copy, one getUserById refresh, badge flips, profile kept', async () => {
    route(/\/lifecycle\/suspend/, () => ({ success: true }));
    route(/\/api\/v1\/users\/u1$/, () => ({
      success: true,
      data: { id: 'u1', status: 'SUSPENDED', profile: { firstName: 'Ada', lastName: 'Lovelace' } },
    }));
    await renderWithActiveUser();

    fireEvent.click(screen.getByRole('button', { name: 'Suspend User' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    });
    await flush();

    expect(
      await screen.findByText('User suspended successfully. They can no longer sign in.'),
    ).toBeInTheDocument();
    // exactly one GET /users/u1 (the status refresh).
    expect(schedulerEndpoints().filter((e) => e === '/api/v1/users/u1')).toHaveLength(1);
    // status-only patch: badge flips but profile.department survives.
    expect(screen.getAllByText('SUSPENDED').length).toBeGreaterThan(0);
    expect(screen.getByText('Engineering')).toBeInTheDocument();
  });

  it('resetPassword skips the getUserById refresh and reloads no memberships', async () => {
    route(/\/lifecycle\/reset_password/, () => ({ success: true }));
    await renderWithActiveUser();
    tabsSendMessage.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send Reset Email' }));
    });
    await flush();

    expect(await screen.findByText('Password reset email sent successfully.')).toBeInTheDocument();
    expect(schedulerEndpoints()).not.toContain('/api/v1/users/u1');
    // no membership reload after reset.
    expect(tabCalls('getUserGroups')).toHaveLength(0);
  });

  it('shows a danger result message when the lifecycle call fails', async () => {
    route(/\/lifecycle\/suspend/, () => ({ success: false, error: 'cannot suspend' }));
    await renderWithActiveUser();

    fireEvent.click(screen.getByRole('button', { name: 'Suspend User' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    });
    await flush();

    expect(await screen.findByText('cannot suspend')).toBeInTheDocument();
  });
});

// ===========================================================================
// 5. Add-to-Group group search (300ms debounce) — bounded, memoized searchGroups.
//    The FINDING (commit 6863313): searchGroups is now stable, so the old
//    ~3x/sec loop is fixed. Pin it BOUNDED to lock that in.
// ===========================================================================
describe('add-to-group: 300ms group search (memoized searchGroups)', () => {
  async function openModal() {
    userContext.current = {
      userInfo: { userId: 'u1', userName: 'Ada Lovelace', userStatus: 'ACTIVE' },
      isLoading: false,
      oktaOrigin: null,
    };
    tabRoute('getUserGroups', () => ({ success: true, data: [] }));
    render(<UsersTab targetTabId={1} />);
    // Load the detected user via the banner (no auto-load).
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    });
    await screen.findByRole('heading', { name: 'Ada Lovelace' });
    fireEvent.click(screen.getByRole('button', { name: 'Add to Group' }));
  }

  it('fires exactly one /api/v1/groups search 300ms after typing and does NOT loop', async () => {
    route(/\/api\/v1\/groups\?q=/, () => ({
      success: true,
      data: [rawGroup({ id: 'g5', profile: { name: 'Design', description: '' } })],
    }));
    await openModal();
    runtimeSendMessage.mockClear();

    // switch to fake timers only after the async modal setup has settled.
    useDebounceTimers();
    setValue(groupSearchInput(), 'des');

    await advance(299);
    expect(schedulerEndpoints().filter((e) => e.startsWith('/api/v1/groups?q='))).toHaveLength(0);

    await advance(1);
    let groupSearches = schedulerEndpoints().filter((e) => e.startsWith('/api/v1/groups?q='));
    expect(groupSearches).toHaveLength(1);

    // Let a lot of time pass with no further typing: a stable searchGroups means
    // the effect does not re-arm, so the count must NOT climb.
    await advance(3000);
    groupSearches = schedulerEndpoints().filter((e) => e.startsWith('/api/v1/groups?q='));
    expect(groupSearches).toHaveLength(1);
    expect(groupSearches[0]).toBe('/api/v1/groups?q=des&limit=20');
  });

  it('does not search group queries shorter than 2 characters', async () => {
    route(/\/api\/v1\/groups\?q=/, () => ({ success: true, data: [] }));
    await openModal();
    runtimeSendMessage.mockClear();

    useDebounceTimers();
    setValue(groupSearchInput(), 'd');
    await advance(1000);

    expect(schedulerEndpoints().filter((e) => e.startsWith('/api/v1/groups?q='))).toHaveLength(0);
  });
});
