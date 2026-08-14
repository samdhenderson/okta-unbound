import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import UserComparisonView from './UserComparisonView';
import type { UserComparisonState } from '../../hooks/useUserComparison';
import type { AppEntry } from './comparison/comparisonAnalytics';
import type { GroupMembership, OktaUser } from '../../../shared/types';

/**
 * Phase 4.2 — the Apps tab states how Okta reports each assignment.
 *
 * Unlike `UserComparisonView.provenance.test.tsx`, this suite renders the REAL
 * `ComparisonDiffTab`: what is under test is the rendered wording, because the
 * whole risk in this phase is a badge that overstates what Okta's single
 * `scope` per app-user can support.
 */

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

const membership = (id: string, name: string): GroupMembership => ({
  group: { id, type: 'OKTA_GROUP', profile: { name } },
  membershipType: 'DIRECT',
  rules: [],
  attribution: 'exact',
});

interface AppBucketFixture {
  onlyCompared: AppEntry[];
  shared: AppEntry[];
  onlyContext: AppEntry[];
}

const DEFAULT_APPS: AppBucketFixture = {
  onlyCompared: [
    { id: 'a1', label: 'Directly Assigned App', scope: 'USER' },
    { id: 'a2', label: 'Group Granted App', scope: 'GROUP' },
    { id: 'a3', label: 'Unreported App' },
  ],
  shared: [{ id: 'a4', label: 'Shared App', scope: 'USER' }],
  onlyContext: [{ id: 'a5', label: 'Context Group Granted App', scope: 'GROUP' }],
};

const comparison = (appBuckets: AppBucketFixture = DEFAULT_APPS): UserComparisonState =>
  ({
    comparedUser,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    searchResults: [],
    isSearching: false,
    activeTab: 'apps',
    setActiveTab: vi.fn(),
    groupBuckets: { onlyCompared: [], shared: [], onlyContext: [] },
    appBuckets,
    // Computed, with no group differences to explain — which is a different
    // fixture state from `undefined` ("the inventory has not resolved yet").
    causes: [],
    groupDiffCount: 0,
    appDiffCount: 4,
    groupSimilarity: 0,
    appSimilarity: 20,
    overallSimilarity: 10,
    similarityScope: 'both',
    appsIncomplete: false,
    isLoading: false,
    loadError: null,
    addingGroupId: null,
    addError: null,
    setAddError: vi.fn(),
    addToContext: vi.fn(),
    addToCompared: vi.fn(),
    contextName: 'Alice Context',
    resolveGroupName: () => undefined,
    comparedName: 'Bob Compared',
    selectUser: vi.fn(),
    changeUser: vi.fn(),
  }) as UserComparisonState;

const renderApps = (appBuckets?: AppBucketFixture) =>
  render(<UserComparisonView contextUser={contextUser} comparison={comparison(appBuckets)} />);

/**
 * Show every row regardless of the diff tab's filter.
 *
 * The tab renders ONE list of parity rows and opens on `Differences`, so a shared
 * row is simply not mounted until the filter is widened. Synchronous and
 * idempotent. A locator concern only — the assertions below are unchanged.
 */
const showAllRows = (): void => {
  const all = screen.queryByRole('button', { name: /^All / });
  if (all && all.getAttribute('aria-pressed') !== 'true') fireEvent.click(all);
};

const rowFor = (label: string): HTMLElement => {
  showAllRows();
  const li = screen.getByTitle(label).closest('li');
  if (!li) throw new Error(`no row for "${label}"`);
  return li;
};

// ================================================================== tests

describe('UserComparisonView — apps tab assignment source', () => {
  it("shows Direct for a reported 'USER' scope", () => {
    renderApps();
    expect(within(rowFor('Directly Assigned App')).getByText('Direct')).toBeInTheDocument();
  });

  it("shows Via group for a reported 'GROUP' scope, in either direction", () => {
    renderApps();
    expect(within(rowFor('Group Granted App')).getByText('Via group')).toBeInTheDocument();
    expect(within(rowFor('Context Group Granted App')).getByText('Via group')).toBeInTheDocument();
  });

  it('shows neither label for an unreported scope, and says so instead', () => {
    renderApps();
    const row = rowFor('Unreported App');

    expect(within(row).queryByText('Direct')).not.toBeInTheDocument();
    expect(within(row).queryByText('Via group')).not.toBeInTheDocument();
    // Distinct from both known scopes, and from a row that simply has no marker.
    expect(within(row).getByText('Source unknown')).toBeInTheDocument();
  });

  it('never renders "Direct" as an exclusivity claim anywhere on the tab', () => {
    const { container } = renderApps();
    const text = container.textContent ?? '';
    expect(text).toContain('Direct');
    expect(text).not.toMatch(/direct only/i);
    expect(text).not.toMatch(/not via (a )?group/i);
  });

  it('leaves the row label itself untouched, so the tab still reads as a list of apps', () => {
    renderApps();
    expect(rowFor('Directly Assigned App').querySelector('span[title]')?.textContent).toBe(
      'Directly Assigned App',
    );
  });

  /**
   * The bucketing shape carries ONE scope per shared row — the compared user's —
   * so the row cannot state a source without stating one user's as if it were
   * both users'. It says that, rather than guessing.
   */
  it("does not present the compared user's scope as the shared row's answer", () => {
    renderApps();
    const row = rowFor('Shared App');

    expect(within(row).queryByText('Direct')).not.toBeInTheDocument();
    expect(within(row).queryByText('Via group')).not.toBeInTheDocument();
    expect(within(row).getByText('Source not compared')).toBeInTheDocument();
  });

  it('renders the same shared-row marker whichever scope the compared entry carries', () => {
    const withGroupScope: AppBucketFixture = {
      ...DEFAULT_APPS,
      shared: [{ id: 'a4', label: 'Shared App', scope: 'GROUP' }],
    };
    renderApps(withGroupScope);

    expect(within(rowFor('Shared App')).getByText('Source not compared')).toBeInTheDocument();
  });

  it('marks every app row, so an unmarked row never has to be interpreted', () => {
    const { container } = renderApps();
    showAllRows();
    const rows = Array.from(container.querySelectorAll('li'));

    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row.textContent).toMatch(/Direct|Via group|Source unknown|Source not compared/);
    }
  });
});

describe('UserComparisonView — the groups tab gains no marker', () => {
  it('renders group rows exactly as their bare label', () => {
    const state = {
      ...comparison(),
      activeTab: 'groups',
      groupBuckets: {
        onlyCompared: [membership('g1', 'VPN Access')],
        shared: [membership('g2', 'All Employees')],
        onlyContext: [membership('g3', 'Finance Approvers')],
      },
    } as UserComparisonState;

    const { container } = render(
      <UserComparisonView contextUser={contextUser} comparison={state} />,
    );

    expect(container.textContent).not.toMatch(/Source unknown|Source not compared|Via group/);
    // The row's LABEL is still exactly the group name — the parity cells beside it
    // are the comparison, not a marker on the label. (This used to assert the whole
    // `<li>` innerHTML, which only worked while a group row was a bare label span.)
    const row = rowFor('All Employees');
    expect(row.querySelector('span[title]')?.textContent).toBe('All Employees');
    expect(within(row).queryByText(/Source|Via group/)).not.toBeInTheDocument();
  });
});
