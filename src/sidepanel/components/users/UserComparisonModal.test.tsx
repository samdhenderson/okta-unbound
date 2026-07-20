import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserComparisonModal from './UserComparisonModal';
import type { OktaUser, OktaGroup, GroupMembership } from '../../../shared/types';

/**
 * CHARACTERIZATION TESTS — these pin the behavior of UserComparisonModal *as it is
 * today*, ahead of the §7 decomposition. Several assertions below deliberately encode
 * behavior that looks like a bug (see the `CHARACTERIZED (not endorsed)` comments).
 * If one of those fails after a refactor, the refactor changed behavior — that is the
 * signal, not a reason to "fix" the test.
 *
 * On mocking: docs/testing.md prefers MSW, but MSW intercepts `fetch`/XHR and this
 * component never touches either. Its real boundary is Chrome message passing —
 * `chrome.runtime.sendMessage({action:'scheduleApiRequest'})` for the scheduler path
 * and `chrome.tabs.sendMessage` for the legacy direct path (§8). So we stub the
 * messaging layer, exactly as the existing hooks/useOktaApi.test.ts does, which keeps
 * the whole useOktaApi -> scheduler stack real.
 */

const TAB_ID = 42;

const mockRuntimeSendMessage = vi.fn();
const mockTabsSendMessage = vi.fn();
const mockStorageGet = vi.fn();
const mockStorageSet = vi.fn();
const mockStorageRemove = vi.fn();

globalThis.chrome = {
  runtime: { sendMessage: mockRuntimeSendMessage },
  tabs: { sendMessage: mockTabsSendMessage },
  storage: {
    local: { get: mockStorageGet, set: mockStorageSet, remove: mockStorageRemove },
  },
} as any;

// addUserToGroup writes an audit entry on success; not under test here.
vi.mock('../../../shared/undoManager', () => ({
  logAction: vi.fn(),
  logBulkRemoveAction: vi.fn(),
  logBulkAddAction: vi.fn(),
}));

// ----------------------------------------------------------------- fixtures

const contextUser: OktaUser = {
  id: 'ctx-1',
  status: 'ACTIVE',
  profile: {
    login: 'alice@example.com',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Context',
  },
};

const comparedUser: OktaUser = {
  id: 'cmp-1',
  status: 'ACTIVE',
  profile: {
    login: 'bob@example.com',
    email: 'bob@example.com',
    firstName: 'Bob',
    lastName: 'Compared',
  },
};

const group = (id: string, name: string): OktaGroup => ({
  id,
  type: 'OKTA_GROUP',
  profile: { name },
});

const gShared = group('g1', 'Shared Group A');
const gContextOnly = group('g2', 'Context Only Group');
const gComparedOnly1 = group('g3', 'Compared Only Group 1');
const gComparedOnly2 = group('g4', 'Compared Only Group 2');

const membership = (g: OktaGroup): GroupMembership => ({
  group: g,
  membershipType: 'DIRECT',
});

/** Context user's groups, as the parent (UserOverview) passes them in. */
const CONTEXT_GROUPS: GroupMembership[] = [membership(gShared), membership(gContextOnly)];

interface AppFixture {
  id: string;
  label: string;
}

// Buckets that fall out of the fixtures above:
//   groups -> onlyCompared [g3,g4], shared [g1], onlyContext [g2]  => jaccard(1,4) = 25
//   apps   -> onlyCompared [a3],    shared [a1], onlyContext [a2]  => jaccard(1,3) = 33
//   overall = round((25 + 33) / 2) = 29
const APPS: Record<string, AppFixture[]> = {
  'ctx-1': [
    { id: 'a1', label: 'Shared App' },
    { id: 'a2', label: 'Context Only App' },
  ],
  'cmp-1': [
    { id: 'a1', label: 'Shared App' },
    { id: 'a3', label: 'Compared Only App' },
  ],
};

// ----------------------------------------------------- configurable message router

interface Scenario {
  /** Apps returned per user id by the scheduled /api/v1/apps request. */
  apps: Record<string, AppFixture[]>;
  /** Compared user's groups, returned (raw) by the scheduled `/api/v1/users/{id}/groups` read. */
  comparedGroups: OktaGroup[];
  /** Override the whole scheduled apps response (to simulate failure). */
  appsResponse?: () => Promise<unknown>;
  /** Override the scheduled `/api/v1/users/{id}/groups` response. */
  groupsResponse?: () => Promise<unknown>;
  /** Override the scheduled `/api/v1/groups/rules` response. */
  rulesResponse?: () => Promise<unknown>;
  /** Override the `searchUsers` response. */
  searchResponse?: () => Promise<unknown>;
  /** Override the PUT that adds a user to a group. */
  addResponse?: () => Promise<unknown>;
  /** Users returned by directory search. */
  searchResults: OktaUser[];
}

let scenario: Scenario;

const appsEndpointUserId = (endpoint: string): string =>
  endpoint.match(/user\.id\+eq\+"([^"]+)"/)?.[1] ?? '';

/** §8: strategy-1 (`q=`) scheduler user-search calls — one per committed search. */
const userSearchCalls = () =>
  mockRuntimeSendMessage.mock.calls.filter(
    (c) =>
      (c[0] as Record<string, unknown>).action === 'scheduleApiRequest' &&
      /^\/api\/v1\/users\?q=/.test(String((c[0] as Record<string, unknown>).endpoint)),
  );

beforeEach(() => {
  vi.clearAllMocks();

  scenario = {
    apps: APPS,
    comparedGroups: [gShared, gComparedOnly1, gComparedOnly2],
    searchResults: [comparedUser, contextUser],
  };

  // RulesCache.get() -> cache miss, so useUserMemberships fetches rules.
  mockStorageGet.mockResolvedValue({});
  mockStorageSet.mockResolvedValue(undefined);
  mockStorageRemove.mockResolvedValue(undefined);

  // Scheduler path: chrome.runtime.sendMessage({ action: 'scheduleApiRequest' }).
  mockRuntimeSendMessage.mockImplementation(async (msg: Record<string, unknown>) => {
    if (msg.action !== 'scheduleApiRequest') return { success: false, error: 'unexpected' };
    const endpoint = String(msg.endpoint);

    if (msg.method === 'PUT' && /^\/api\/v1\/groups\/[^/]+\/users\//.test(endpoint)) {
      if (scenario.addResponse) return scenario.addResponse();
      return { success: true };
    }

    if (endpoint.startsWith('/api/v1/apps')) {
      if (scenario.appsResponse) return scenario.appsResponse();
      const userId = appsEndpointUserId(endpoint);
      return { success: true, data: scenario.apps[userId] ?? [], headers: {} };
    }

    // §8: user search now routes through the scheduler (`/api/v1/users?q=|search=`).
    if (endpoint.startsWith('/api/v1/users?')) {
      if (scenario.searchResponse) return scenario.searchResponse();
      return { success: true, data: scenario.searchResults, headers: {} };
    }

    // §8: the compared user's group memberships now route through the scheduler
    // (`GET /api/v1/users/{id}/groups`). getUserGroupsRequest wraps the RAW groups,
    // so this returns raw groups (not the old `{ group }` membership wrapper).
    if (/^\/api\/v1\/users\/[^/?]+\/groups/.test(endpoint)) {
      if (scenario.groupsResponse) return scenario.groupsResponse();
      return { success: true, data: scenario.comparedGroups };
    }

    // §8: the membership rule read now routes through the scheduler
    // (`GET /api/v1/groups/rules`); fetchGroupRulesRequest formats the RAW rules
    // in-panel. Empty by default (rules only affect DIRECT/RULE classification,
    // not the group diff these tests assert on).
    if (/^\/api\/v1\/groups\/rules/.test(endpoint)) {
      if (scenario.rulesResponse) return scenario.rulesResponse();
      return { success: true, data: [] };
    }

    return { success: true, data: [], headers: {} };
  });

  // §8: UserComparisonModal makes no direct chrome.tabs.sendMessage calls anymore
  // (all membership reads route through the scheduler above). Stub defensively.
  mockTabsSendMessage.mockResolvedValue({ success: false, error: 'no direct tab calls' });
});

// ----------------------------------------------------------------- harness

interface HarnessProps {
  contextGroups?: GroupMembership[];
  onGroupsChanged?: () => void;
  onClose?: () => void;
}

/**
 * Mirrors UserOverview.tsx:273-282 — the modal is permanently mounted and only
 * `isOpen` toggles, and `onGroupsChanged` is a fresh arrow on every parent render.
 * The bump button lets a test force parent re-renders without changing any input.
 */
const Harness: React.FC<HarnessProps> = ({
  contextGroups = CONTEXT_GROUPS,
  onGroupsChanged,
  onClose,
}) => {
  const [isOpen, setIsOpen] = React.useState(true);
  const [bump, setBump] = React.useState(0);

  return (
    <div>
      <button data-testid="bump" onClick={() => setBump((b) => b + 1)}>
        bump {bump}
      </button>
      <button data-testid="toggle" onClick={() => setIsOpen((o) => !o)}>
        toggle
      </button>
      <UserComparisonModal
        isOpen={isOpen}
        onClose={onClose ?? (() => setIsOpen(false))}
        contextUser={contextUser}
        contextGroups={contextGroups}
        targetTabId={TAB_ID}
        onGroupsChanged={() => onGroupsChanged?.()}
      />
    </div>
  );
};

// ----------------------------------------------------------------- helpers

const searchInput = () => screen.getByPlaceholderText('Search by email, name, or login…');

/** Drives the search phase and picks Bob. The debounce is 600ms and is not injectable. */
async function selectComparedUser(user: OktaUser = comparedUser) {
  await userEvent.type(searchInput(), 'bob');
  const name = `${user.profile.firstName} ${user.profile.lastName}`;
  const card = await screen.findByText(name, {}, { timeout: 3000 });
  await userEvent.click(card);
}

async function waitForLoadToSettle() {
  await waitFor(() =>
    expect(screen.queryByText('Crunching memberships and assignments…')).not.toBeInTheDocument(),
  );
}

async function openComparison() {
  await selectComparedUser();
  await waitForLoadToSettle();
}

const tab = (name: 'Overview' | 'Groups' | 'Apps') =>
  screen.getByRole('tab', { name: new RegExp(`^${name}`) });

const gotoTab = async (name: 'Overview' | 'Groups' | 'Apps') => userEvent.click(tab(name));

/** The <li> row for a diff item, found via the `title` attr on its label span. */
function rowFor(label: string): HTMLElement {
  const span = screen.getByTitle(label);
  const li = span.closest('li');
  if (!li) throw new Error(`No row found for "${label}"`);
  return li;
}

const addButtonFor = (label: string) => within(rowFor(label)).getByRole('button', { name: 'Add' });

/** Which bucket card a given diff item currently lives in, by the card's heading. */
function bucketTitleOf(label: string): string {
  const card = rowFor(label).closest('div.overflow-hidden');
  if (!card) throw new Error(`No bucket card for "${label}"`);
  // The bucket heading is the first element carrying a title attr inside the card.
  return (
    card.querySelector('[title]')?.getAttribute('title') ??
    (() => {
      throw new Error('no bucket title');
    })()
  );
}

/** Item labels currently listed in the bucket whose heading is `title`. */
function bucketItems(title: string): string[] {
  const heading = screen.getByTitle(title);
  const card = heading.closest('div.overflow-hidden');
  if (!card) throw new Error(`No bucket card titled "${title}"`);
  return Array.from(card.querySelectorAll('li')).map((li) =>
    (li.querySelector('span[title]')?.textContent ?? '').trim(),
  );
}

const getUserAppsCalls = () =>
  mockRuntimeSendMessage.mock.calls.filter(([m]) =>
    String(m.endpoint ?? '').startsWith('/api/v1/apps'),
  );

const getUserGroupsCalls = () =>
  mockRuntimeSendMessage.mock.calls.filter(
    (c) =>
      (c[0] as Record<string, unknown>).action === 'scheduleApiRequest' &&
      /^\/api\/v1\/users\/[^/?]+\/groups/.test(String((c[0] as Record<string, unknown>).endpoint)),
  );

const addUserToGroupCalls = () =>
  mockRuntimeSendMessage.mock.calls.filter(([m]) => m.method === 'PUT');

// ================================================================== tests

describe('UserComparisonModal', () => {
  describe('phase switching + reset on close', () => {
    it('renders the search phase when no compared user is selected', () => {
      render(<Harness />);

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
      expect(
        screen.getByRole('heading', { name: 'Compare with another user' }),
      ).toBeInTheDocument();
      expect(searchInput()).toHaveValue('');
      expect(screen.getByText('Start typing to search')).toBeInTheDocument();
      // No comparison UI yet.
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
      // The "Change user" footer action only exists in the comparison phase.
      expect(screen.queryByRole('button', { name: /Change user/ })).not.toBeInTheDocument();
    });

    it('switches to the comparison phase once a user is selected', async () => {
      render(<Harness />);
      await openComparison();

      expect(screen.getByRole('heading', { name: 'Side-by-side comparison' })).toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText('Search by email, name, or login…'),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getByText('Context')).toBeInTheDocument();
      expect(screen.getByText('Compared')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Change user/ })).toBeInTheDocument();
    });

    it('resets to a pristine search phase on close/reopen even though it never unmounts', async () => {
      render(<Harness />);
      await openComparison();

      // Dirty every piece of resettable state: add a group, and leave the Apps tab active.
      await gotoTab('Groups');
      await userEvent.click(addButtonFor('Compared Only Group 1'));
      await waitFor(() => expect(addUserToGroupCalls()).toHaveLength(1));
      await gotoTab('Apps');
      expect(tab('Apps')).toHaveAttribute('aria-selected', 'true');

      // Close (parent keeps the component mounted, only isOpen flips) then reopen.
      await userEvent.click(screen.getByTestId('toggle'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await userEvent.click(screen.getByTestId('toggle'));

      // Back to a pristine search phase: query cleared, results cleared.
      expect(
        screen.getByRole('heading', { name: 'Compare with another user' }),
      ).toBeInTheDocument();
      expect(searchInput()).toHaveValue('');
      expect(screen.queryByText('Search Results')).not.toBeInTheDocument();
      expect(screen.getByText('Start typing to search')).toBeInTheDocument();

      // Reselecting the same user refires both app loads, and activeTab is back to Overview.
      const appCallsBefore = getUserAppsCalls().length;
      await openComparison();
      expect(getUserAppsCalls()).toHaveLength(appCallsBefore + 2);
      expect(tab('Overview')).toHaveAttribute('aria-selected', 'true');

      // addedGroupIds was cleared too: the group is back in the "only compared" bucket.
      await gotoTab('Groups');
      expect(bucketTitleOf('Compared Only Group 1')).toBe('Only Bob Compared');
    });
  });

  describe('load effect timing (riskyBit: the load-bearing eslint-disable at L128)', () => {
    it('fires exactly one load per compared-user change and is immune to parent re-renders', async () => {
      render(<Harness />);
      await openComparison();

      expect(getUserAppsCalls()).toHaveLength(2);
      expect(getUserGroupsCalls()).toHaveLength(1);

      // useOktaApi rebuilds getUserApps/addUserToGroup on EVERY render with no memo,
      // so the effect's [comparedUser]-only dep array is load-bearing. If someone
      // "corrects" the deps to satisfy exhaustive-deps this explodes into a render loop.
      await userEvent.click(screen.getByTestId('bump'));
      await userEvent.click(screen.getByTestId('bump'));
      await userEvent.click(screen.getByTestId('bump'));
      // Guard against a vacuous test: prove the parent really re-rendered. The modal is
      // not memoized, so a parent render is a modal render.
      expect(screen.getByTestId('bump')).toHaveTextContent('bump 3');
      await waitForLoadToSettle();

      expect(getUserAppsCalls()).toHaveLength(2);
      expect(getUserGroupsCalls()).toHaveLength(1);
    });

    it('requests apps for BOTH users on every compared-user change, including the unchanged context user', async () => {
      render(<Harness />);
      await openComparison();

      const ids = getUserAppsCalls().map(([m]) => appsEndpointUserId(String(m.endpoint)));
      expect(ids).toEqual(['ctx-1', 'cmp-1']);

      // CHARACTERIZED (not endorsed): contextApps is not cached or keyed by
      // contextUser.id, so changing the compared user refetches the context user's
      // apps as well.
      await userEvent.click(screen.getByRole('button', { name: /Change user/ }));
      await openComparison();

      expect(getUserAppsCalls().map(([m]) => appsEndpointUserId(String(m.endpoint)))).toEqual([
        'ctx-1',
        'cmp-1',
        'ctx-1',
        'cmp-1',
      ]);
    });

    it('routes app loads through the background scheduler', async () => {
      render(<Harness />);
      await openComparison();

      expect(mockRuntimeSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'scheduleApiRequest',
          endpoint: '/api/v1/apps?filter=user.id+eq+"cmp-1"&limit=200',
          method: 'GET',
          tabId: TAB_ID,
          priority: 'normal',
        }),
      );
    });
  });

  describe('bucketing', () => {
    it('buckets groups into onlyCompared / shared / onlyContext', async () => {
      render(<Harness />);
      await openComparison();
      await gotoTab('Groups');

      expect(bucketItems('Only Bob Compared')).toEqual([
        'Compared Only Group 1',
        'Compared Only Group 2',
      ]);
      expect(bucketItems('Shared')).toEqual(['Shared Group A']);
      expect(bucketItems('Only Alice Context')).toEqual(['Context Only Group']);
    });

    it('buckets apps into onlyCompared / shared / onlyContext', async () => {
      render(<Harness />);
      await openComparison();
      await gotoTab('Apps');

      expect(bucketItems('Only Bob Compared')).toEqual(['Compared Only App']);
      expect(bucketItems('Shared')).toEqual(['Shared App']);
      expect(bucketItems('Only Alice Context')).toEqual(['Context Only App']);
    });

    it('counts an optimistically-added group in `shared` exactly once, before contextGroups refreshes', async () => {
      render(<Harness />);
      await openComparison();
      await gotoTab('Groups');

      await userEvent.click(addButtonFor('Compared Only Group 1'));
      await waitFor(() => expect(bucketItems('Shared')).toContain('Compared Only Group 1'));

      // The parent's contextGroups has NOT refreshed yet — assert no double-count.
      expect(bucketItems('Shared')).toEqual(['Shared Group A', 'Compared Only Group 1']);
      expect(bucketItems('Only Bob Compared')).toEqual(['Compared Only Group 2']);
      expect(bucketItems('Only Alice Context')).toEqual(['Context Only Group']);
    });

    it('renders no Add action on the Apps tab', async () => {
      render(<Harness />);
      await openComparison();
      await gotoTab('Apps');

      expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
    });
  });

  describe('group add — success path', () => {
    it('sends the exact payload, re-buckets, drops the Add button and notifies the parent once', async () => {
      const onGroupsChanged = vi.fn();
      render(<Harness onGroupsChanged={onGroupsChanged} />);
      await openComparison();
      await gotoTab('Groups');

      expect(tab('Groups')).toHaveTextContent('3'); // diff badge: 2 onlyCompared + 1 onlyContext

      await userEvent.click(addButtonFor('Compared Only Group 1'));

      await waitFor(() => expect(onGroupsChanged).toHaveBeenCalledTimes(1));
      expect(mockRuntimeSendMessage).toHaveBeenCalledWith({
        action: 'scheduleApiRequest',
        endpoint: '/api/v1/groups/g3/users/ctx-1',
        method: 'PUT',
        body: undefined,
        tabId: TAB_ID,
        priority: 'normal',
      });

      // The disappearing Add button IS the success affordance — there is no other one.
      // It vanishes because renderAction re-finds the group in the live onlyCompared
      // bucket by id, and addedGroupIds has already moved it to `shared`.
      expect(bucketTitleOf('Compared Only Group 1')).toBe('Shared');
      expect(
        within(rowFor('Compared Only Group 1')).queryByRole('button', { name: 'Add' }),
      ).toBeNull();

      // Badge decrements, and the remaining row's Add button is enabled again.
      expect(tab('Groups')).toHaveTextContent('2');
      expect(addButtonFor('Compared Only Group 2')).toBeEnabled();
    });
  });

  describe('group add — both failure channels', () => {
    const expectFailed = async (message: string) => {
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(message);
      // Group stays put, lock releases.
      expect(bucketTitleOf('Compared Only Group 1')).toBe('Only Bob Compared');
      expect(addButtonFor('Compared Only Group 1')).toBeEnabled();
    };

    it('renders result.error when the API resolves { success:false, error }', async () => {
      const onGroupsChanged = vi.fn();
      scenario.addResponse = async () => ({ success: false, error: 'Insufficient permissions' });
      render(<Harness onGroupsChanged={onGroupsChanged} />);
      await openComparison();
      await gotoTab('Groups');

      await userEvent.click(addButtonFor('Compared Only Group 1'));

      await expectFailed('Insufficient permissions');
      expect(onGroupsChanged).not.toHaveBeenCalled();
    });

    it('falls back to `Failed to add to {groupName}` when success:false carries no error', async () => {
      scenario.addResponse = async () => ({ success: false });
      render(<Harness />);
      await openComparison();
      await gotoTab('Groups');

      await userEvent.click(addButtonFor('Compared Only Group 1'));

      await expectFailed('Failed to add to Compared Only Group 1');
    });

    it('renders the message of a thrown Error', async () => {
      const onGroupsChanged = vi.fn();
      scenario.addResponse = async () => {
        throw new Error('Extension context invalidated');
      };
      render(<Harness onGroupsChanged={onGroupsChanged} />);
      await openComparison();
      await gotoTab('Groups');

      await userEvent.click(addButtonFor('Compared Only Group 1'));

      await expectFailed('Extension context invalidated');
      expect(onGroupsChanged).not.toHaveBeenCalled();
    });

    it('falls back to a generic message when a non-Error is thrown', async () => {
      scenario.addResponse = async () => {
        throw 'just a string';
      };
      render(<Harness />);
      await openComparison();
      await gotoTab('Groups');

      await userEvent.click(addButtonFor('Compared Only Group 1'));

      await expectFailed('Failed to add user to group');
    });

    it('dismisses the add error, and clears it when the next add starts', async () => {
      scenario.addResponse = async () => ({ success: false, error: 'Nope' });
      render(<Harness />);
      await openComparison();
      await gotoTab('Groups');

      await userEvent.click(addButtonFor('Compared Only Group 1'));
      await screen.findByRole('alert');

      await userEvent.click(screen.getByRole('button', { name: 'Dismiss message' }));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('single-flight add lock (riskyBit: it is global, not per-row)', () => {
    it('disables EVERY Add button while one add is in flight, and releases them all when it settles', async () => {
      let release!: (v: unknown) => void;
      scenario.addResponse = () => new Promise((res) => (release = res));

      render(<Harness />);
      await openComparison();
      await gotoTab('Groups');

      await userEvent.click(addButtonFor('Compared Only Group 1'));

      await waitFor(() => expect(addButtonFor('Compared Only Group 2')).toBeDisabled());
      expect(addButtonFor('Compared Only Group 1')).toBeDisabled();

      // Clicking the other row issues no second request.
      await userEvent.click(addButtonFor('Compared Only Group 2'));
      expect(addUserToGroupCalls()).toHaveLength(1);

      release({ success: true });

      await waitFor(() => expect(addButtonFor('Compared Only Group 2')).toBeEnabled());
    });

    it('CHARACTERIZED: "Change user" does NOT clear addingGroupId, so the lock survives a reselect', async () => {
      // handleChangeUser (L136-146) omits setAddingGroupId(null) that the close effect
      // (L88-101) performs. Unifying the two reset paths would re-enable the buttons
      // mid-flight — that is a behavior change, not a cleanup.
      let release!: (v: unknown) => void;
      scenario.addResponse = () => new Promise((res) => (release = res));

      render(<Harness />);
      await openComparison();
      await gotoTab('Groups');

      await userEvent.click(addButtonFor('Compared Only Group 1'));
      await waitFor(() => expect(addButtonFor('Compared Only Group 2')).toBeDisabled());

      await userEvent.click(screen.getByRole('button', { name: /Change user/ }));
      await openComparison();
      await gotoTab('Groups');

      // Still globally locked by the original, still-pending add.
      expect(addButtonFor('Compared Only Group 1')).toBeDisabled();
      expect(addButtonFor('Compared Only Group 2')).toBeDisabled();

      release({ success: true });
      await waitFor(() => expect(addButtonFor('Compared Only Group 2')).toBeEnabled());
    });
  });

  describe('similarity math', () => {
    it('renders round((groupSim + appSim) / 2) in the hero', async () => {
      render(<Harness />);
      await openComparison();

      // groups jaccard(1,4)=25, apps jaccard(1,3)=33 -> round(29) = 29
      expect(screen.getByText('29%')).toBeInTheDocument();
      expect(screen.getByText('Match')).toBeInTheDocument();
    });

    it('CHARACTERIZED: identical groups + no apps scores 50%, not 100%', async () => {
      // jaccard(0,0) === 0 for the empty app union, and overall averages the two —
      // so a perfect group match is halved. Making the empty union return 100 would
      // change the headline number for every app-less pair.
      scenario.apps = { 'ctx-1': [], 'cmp-1': [] };
      scenario.comparedGroups = [gShared, gContextOnly];
      render(<Harness />);
      await openComparison();

      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('shows the loading placeholders instead of a percentage while loading', async () => {
      let releaseGroups!: (v: unknown) => void;
      scenario.groupsResponse = () => new Promise((res) => (releaseGroups = res));

      render(<Harness />);
      await selectComparedUser();

      expect(await screen.findByText('··')).toBeInTheDocument();
      expect(screen.getByText('— —')).toBeInTheDocument();
      expect(screen.queryByText('Match')).not.toBeInTheDocument();

      releaseGroups({ success: true, data: scenario.comparedGroups });
      await waitForLoadToSettle();
      expect(screen.getByText('Match')).toBeInTheDocument();
    });

    it('reports per-category overlap on the overview cards', async () => {
      render(<Harness />);
      await openComparison();

      expect(screen.getByText('4 total · 25% overlap')).toBeInTheDocument();
      expect(screen.getByText('3 total · 33% overlap')).toBeInTheDocument();
    });
  });

  describe('loading / error gating', () => {
    it('keeps the hero and tab bar but hides the tab body while loading', async () => {
      let releaseGroups!: (v: unknown) => void;
      scenario.groupsResponse = () => new Promise((res) => (releaseGroups = res));

      render(<Harness />);
      await selectComparedUser();

      expect(await screen.findByText('Crunching memberships and assignments…')).toBeInTheDocument();
      // CHARACTERIZED: the tablist stays mounted during load; only the body is gated.
      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.queryByText('Group memberships')).not.toBeInTheDocument();

      releaseGroups({ success: true, data: scenario.comparedGroups });
      await waitForLoadToSettle();
      expect(screen.getByText('Group memberships')).toBeInTheDocument();
    });

    it('replaces the tab body with a danger alert when the membership load fails', async () => {
      scenario.groupsResponse = async () => ({ success: false, error: 'Okta says no' });

      render(<Harness />);
      await selectComparedUser();
      await waitForLoadToSettle();

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Okta says no');
      expect(screen.queryByText('Group memberships')).not.toBeInTheDocument();
      // Hero survives.
      expect(screen.getByText('Match')).toBeInTheDocument();
    });

    it('does NOT surface a rules-fetch failure — it degrades silently to no rules', async () => {
      scenario.rulesResponse = async () => ({ success: false, error: 'rules boom' });

      render(<Harness />);
      await openComparison();
      await gotoTab('Groups');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(bucketItems('Shared')).toEqual(['Shared Group A']);
    });
  });

  describe('app-fetch resilience (riskyBit: appsError is unreachable dead state)', () => {
    it('CHARACTERIZED: a failing scheduled /api/v1/apps request renders as "0 apps", never as an error', async () => {
      // getUserApps (userOperations.ts:70-86) wraps its pagination loop in try/catch and
      // returns the accumulated array, so the modal's .catch at L117 can never fire and
      // appsError can never be non-null. Wiring it up "properly" would start blanking the
      // whole tab body behind an alert.
      scenario.appsResponse = async () => ({ success: false, error: '500 from Okta' });

      render(<Harness />);
      await openComparison();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      // The Match % is still a number — a total app failure is indistinguishable from
      // "no apps", and silently halves the headline score.
      expect(screen.getByText('13%')).toBeInTheDocument(); // Math.round((25 + 0) / 2) = 13

      await gotoTab('Apps');
      expect(bucketItems('Only Bob Compared')).toEqual([]);
      expect(bucketItems('Shared')).toEqual([]);
      expect(bucketItems('Only Alice Context')).toEqual([]);
    });

    it('CHARACTERIZED: a thrown app request is also swallowed into an empty list', async () => {
      scenario.appsResponse = async () => {
        throw new Error('port closed');
      };

      render(<Harness />);
      await openComparison();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('0 total · 0% overlap')).toBeInTheDocument();
    });
  });

  describe('search phase', () => {
    it('filters the context user out of the results', async () => {
      render(<Harness />);
      await userEvent.type(searchInput(), 'e');

      // Under the 2-char minimum: no search is issued.
      await new Promise((r) => setTimeout(r, 700));
      expect(userSearchCalls()).toHaveLength(0);

      await userEvent.type(searchInput(), 'xample');
      await screen.findByText('Search Results', {}, { timeout: 3000 });

      // The API returned both Bob and Alice; only Bob is offered as a result card.
      // (Scoped to the result headings: "Alice Context" also appears in the blurb above.)
      const resultNames = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent);
      expect(resultNames).toEqual(['Bob Compared']);
      expect(screen.getByText('1 user')).toBeInTheDocument();
    });

    it('CHARACTERIZED: a failed search shows no error at all — the modal drops useUserSearch.error', async () => {
      // L62 destructures only 5 of the hook's 6 returns; `error` is deliberately omitted.
      // Wiring it up during the split would be a UX change (§8), not a refactor.
      scenario.searchResponse = async () => ({ success: false, error: 'Search backend exploded' });

      render(<Harness />);
      await userEvent.type(searchInput(), 'bob');

      // §8: the search now routes through the scheduler (`q=bob`).
      await waitFor(
        () =>
          expect(mockRuntimeSendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
              action: 'scheduleApiRequest',
              endpoint: '/api/v1/users?q=bob&limit=20',
            }),
          ),
        { timeout: 3000 },
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText('Search backend exploded')).not.toBeInTheDocument();
      expect(screen.queryByText('Search Results')).not.toBeInTheDocument();
      // Nor does the "start typing" prompt come back — the phase renders as simply empty.
      expect(screen.queryByText('Start typing to search')).not.toBeInTheDocument();
    });

    it('clearing the query restores the empty prompt and drops the results', async () => {
      render(<Harness />);
      await userEvent.type(searchInput(), 'bob');
      await screen.findByText('Search Results', {}, { timeout: 3000 });

      await userEvent.clear(searchInput());

      await waitFor(() => expect(screen.queryByText('Search Results')).not.toBeInTheDocument());
      expect(screen.getByText('Start typing to search')).toBeInTheDocument();
    });
  });

  describe('tab navigation', () => {
    it('exposes tablist/tab semantics with aria-selected tracking the active tab', async () => {
      render(<Harness />);
      await openComparison();

      expect(screen.getAllByRole('tab')).toHaveLength(3);
      expect(tab('Overview')).toHaveAttribute('aria-selected', 'true');
      expect(tab('Groups')).toHaveAttribute('aria-selected', 'false');

      await gotoTab('Groups');
      expect(tab('Groups')).toHaveAttribute('aria-selected', 'true');
      expect(tab('Overview')).toHaveAttribute('aria-selected', 'false');
    });

    it('renders diff badges only when the count is greater than zero', async () => {
      scenario.comparedGroups = [gShared, gContextOnly]; // identical groups -> 0 group diff
      render(<Harness />);
      await openComparison();

      expect(tab('Overview')).toHaveTextContent(/^Overview$/);
      expect(tab('Groups')).toHaveTextContent(/^Groups$/);
      expect(tab('Apps')).toHaveTextContent('2');
    });

    it('jumps to the Groups and Apps tabs from the overview cards', async () => {
      render(<Harness />);
      await openComparison();

      const links = screen.getAllByRole('button', { name: /View details/ });
      expect(links).toHaveLength(2);

      await userEvent.click(links[0]);
      expect(tab('Groups')).toHaveAttribute('aria-selected', 'true');

      await gotoTab('Overview');
      await userEvent.click(screen.getAllByRole('button', { name: /View details/ })[1]);
      expect(tab('Apps')).toHaveAttribute('aria-selected', 'true');
    });

    it('offers the "can be copied over" hint only for groups', async () => {
      render(<Harness />);
      await openComparison();

      expect(screen.getByText('2 can be copied over')).toBeInTheDocument();
      expect(screen.queryByText('1 can be copied over')).not.toBeInTheDocument();
    });
  });

  describe('modal a11y', () => {
    it('is a labelled, modal dialog', () => {
      render(<Harness />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAccessibleName('Compare with another user');
    });

    it('closes on Escape', async () => {
      const onClose = vi.fn();
      render(<Harness onClose={onClose} />);

      await userEvent.type(searchInput(), '{Escape}');

      expect(onClose).toHaveBeenCalled();
    });

    it('CHARACTERIZED: the search input is NOT focused on open despite autoFocus', async () => {
      // The <input autoFocus> at L429 is focused during commit, but shared Modal's own
      // effect then focuses the first focusable in the panel — the header close button —
      // and parent effects run after child commit. Migrating this raw input to shared
      // Input must not change this (already-broken) outcome silently.
      render(<Harness />);

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close modal' }));
      expect(document.activeElement).not.toBe(searchInput());
    });

    it('traps Tab focus inside the panel', async () => {
      render(<Harness />);
      const dialog = screen.getByRole('dialog');
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled])',
        ),
      );
      const last = focusables[focusables.length - 1];

      last.focus();
      await userEvent.tab();

      expect(dialog).toContainElement(document.activeElement as HTMLElement);
      expect(document.activeElement).toBe(focusables[0]);
    });
  });
});
