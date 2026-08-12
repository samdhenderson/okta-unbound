import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import UserComparisonView from './UserComparisonView';
import type { UserComparisonState } from '../../hooks/useUserComparison';
import type { GroupMembership, MembershipRule, OktaUser } from '../../../shared/types';

/**
 * Phase 3.7 — the Groups tab states how each membership was granted.
 *
 * This suite renders the REAL `ComparisonDiffTab` (unlike
 * `UserComparisonView.provenance.test.tsx`, which stubs it to inspect props),
 * because what is under test is the wording a reader actually sees on a row.
 * `GroupSourceIndicator.test.tsx` covers the per-state vocabulary; here the
 * questions are which rows get a source line at all, and whether the Apps tab
 * still renders exactly what phase 4.2 gave it.
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

const contractorRule: MembershipRule = {
  id: '0prFAKErule00001',
  name: 'Contractors → VPN Access',
  status: 'ACTIVE',
  conditionExpression: 'user.userType == "Contractor"',
};

const legacyA: MembershipRule = {
  id: '0prFAKErule00002',
  name: 'Legacy A',
  status: 'ACTIVE',
  conditionExpression: 'isMemberOfAnyGroup("00gFAKEgroup0009")',
};

const legacyB: MembershipRule = {
  id: '0prFAKErule00003',
  name: 'Legacy B',
  status: 'ACTIVE',
  conditionExpression: 'isMemberOfAnyGroup("00gFAKEgroup0010")',
};

/** Compared-only: one rule, proven. */
const ruleBased: GroupMembership = {
  group: { id: '00gFAKEgroup0001', type: 'OKTA_GROUP', profile: { name: 'VPN Access' } },
  membershipType: 'RULE_BASED',
  rules: [contractorRule],
  attribution: 'exact',
};

/** Shared: a plain manual add on the compared user. */
const sharedDirect: GroupMembership = {
  group: { id: '00gFAKEgroup0002', type: 'OKTA_GROUP', profile: { name: 'All Employees' } },
  membershipType: 'DIRECT',
  rules: [],
  attribution: 'exact',
};

/** Context-only: a candidate set nothing separates. */
const ambiguous: GroupMembership = {
  group: { id: '00gFAKEgroup0003', type: 'OKTA_GROUP', profile: { name: 'Finance Approvers' } },
  membershipType: 'RULE_BASED',
  rules: [legacyA, legacyB],
  attribution: 'ambiguous',
};

/** Context-only: the rules never loaded, so nothing was classified. */
const unknown: GroupMembership = {
  group: { id: '00gFAKEgroup0004', type: 'OKTA_GROUP', profile: { name: 'Unclassified Group' } },
  membershipType: 'UNKNOWN',
  rules: [],
  attribution: 'ambiguous',
};

const comparison = (over: Partial<UserComparisonState> = {}): UserComparisonState =>
  ({
    comparedUser,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    searchResults: [],
    isSearching: false,
    activeTab: 'groups',
    setActiveTab: vi.fn(),
    groupBuckets: {
      onlyCompared: [ruleBased],
      shared: [sharedDirect],
      onlyContext: [ambiguous, unknown],
    },
    appBuckets: {
      onlyCompared: [{ id: 'a1', label: 'Salesforce', scope: 'USER' as const }],
      shared: [{ id: 'a2', label: 'Slack' }],
      onlyContext: [{ id: 'a3', label: 'Figma', scope: 'GROUP' as const }],
    },
    groupDiffCount: 3,
    appDiffCount: 2,
    groupSimilarity: 25,
    appSimilarity: 33,
    overallSimilarity: 29,
    isLoading: false,
    loadError: null,
    addingGroupId: null,
    addError: null,
    setAddError: vi.fn(),
    addToContext: vi.fn(),
    addToCompared: vi.fn(),
    contextName: 'Alice Context',
    comparedName: 'Bob Compared',
    selectUser: vi.fn(),
    changeUser: vi.fn(),
    ...over,
  }) as UserComparisonState;

const renderView = (over?: Partial<UserComparisonState>) =>
  render(<UserComparisonView contextUser={contextUser} comparison={comparison(over)} />);

/** The <li> row for a group, found through the `title` attr on its label span. */
const rowFor = (label: string): HTMLElement => {
  const li = screen.getByTitle(label).closest('li');
  if (!li) throw new Error(`no row for "${label}"`);
  return li;
};

// ================================================================== tests

describe('UserComparisonView — the groups tab says how a membership was granted', () => {
  it('names the rule on a proven rule-based row', () => {
    renderView();

    expect(
      within(rowFor('VPN Access')).getByText('Added by Rule: Contractors → VPN Access'),
    ).toBeInTheDocument();
  });

  it('offers an ambiguous row its whole candidate set, never one confident rule', () => {
    renderView();
    const row = rowFor('Finance Approvers');

    expect(
      within(row).getByText('Possible rule: Legacy A, Legacy B (2 candidates, unresolved)'),
    ).toBeInTheDocument();
    expect(row.textContent).not.toMatch(/Added by Rule/);
  });

  it('does not render an unclassified membership as a manual add', () => {
    renderView();
    const row = rowFor('Unclassified Group');

    expect(within(row).getByText('Source not determined')).toBeInTheDocument();
    expect(row.textContent).not.toMatch(/directly/i);
  });

  it('leaves the row label itself first and separately titled', () => {
    renderView();

    expect(rowFor('VPN Access').querySelector('span[title]')?.textContent).toBe('VPN Access');
  });

  it('keeps the per-row Add affordance beside the new source line', () => {
    renderView();

    expect(within(rowFor('VPN Access')).getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(
      within(rowFor('Finance Approvers')).getByRole('button', { name: 'Add' }),
    ).toBeInTheDocument();
  });

  /**
   * `bucketGroups` puts ONE user's membership in `shared` — the compared user's,
   * except for a context-only group optimistically copied onto them — so which
   * user a shared row describes varies. Stating a source there would present one
   * user's provenance as if it described both.
   */
  it('states no source on a shared row, whose membership is only one user’s', () => {
    renderView();
    const row = rowFor('All Employees');

    expect(within(row).queryByText('Added directly')).not.toBeInTheDocument();
    expect(row.textContent).toBe('All Employees');
  });
});

describe('UserComparisonView — the apps tab is unchanged by the groups source line', () => {
  it('still marks every app row with its assignment source, and no group wording', () => {
    const { container } = renderView({ activeTab: 'apps' });

    expect(within(rowFor('Salesforce')).getByText('Direct')).toBeInTheDocument();
    expect(within(rowFor('Figma')).getByText('Via group')).toBeInTheDocument();
    expect(within(rowFor('Slack')).getByText('Source not compared')).toBeInTheDocument();

    const text = container.textContent ?? '';
    expect(text).not.toMatch(/Added by Rule|Likely added by rule|Possible rule/);
    expect(text).not.toMatch(/Added directly|Source not determined/);
  });
});
