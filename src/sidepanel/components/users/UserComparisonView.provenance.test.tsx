import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import UserComparisonView from './UserComparisonView';
import type { UserComparisonState } from '../../hooks/useUserComparison';
import type { ParityRow } from './comparison/comparisonAnalytics';
import type { GroupMembership, MembershipRule, OktaUser } from '../../../shared/types';

/**
 * Phase 3.6 — the comparison carries provenance all the way to the row model.
 *
 * `ComparisonDiffTab` does not yet *render* provenance (that is 3.7), so a DOM
 * assertion could not tell a carried membership from a discarded one. This suite
 * therefore stubs the diff tab and inspects the props it is handed — the exact
 * point at which the old code had already thrown `membershipType`, `rules` and
 * `attribution` away.
 *
 * It also pins the other half of the contract: the **apps** branch of the same
 * shared component still receives bare `{ id, label }` rows.
 */

/** Every props object `ComparisonDiffTab` was rendered with, in render order. */
const diffTabProps: Record<string, unknown>[] = [];

vi.mock('./comparison/ComparisonDiffTab', () => ({
  default: (props: Record<string, unknown>) => {
    diffTabProps.push(props);
    return <div data-testid="diff-tab" />;
  },
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

const contractorRule: MembershipRule = {
  id: '0prFAKErule00001',
  name: 'Contractors → VPN Access',
  status: 'ACTIVE',
  conditionExpression: 'user.userType == "Contractor"',
  groupIds: ['00gFAKEgroup0001'],
  userAttributes: ['userType'],
};

const legacyRuleA: MembershipRule = {
  id: '0prFAKErule00002',
  name: 'Legacy A',
  status: 'ACTIVE',
  conditionExpression: 'isMemberOfAnyGroup("00gFAKEgroup0009")',
};

const legacyRuleB: MembershipRule = {
  id: '0prFAKErule00003',
  name: 'Legacy B',
  status: 'ACTIVE',
  conditionExpression: 'isMemberOfAnyGroup("00gFAKEgroup0010")',
};

/** Compared-only, attributed to exactly one rule with proven evidence. */
const ruleBasedMembership: GroupMembership = {
  group: {
    id: '00gFAKEgroup0001',
    type: 'OKTA_GROUP',
    profile: { name: 'VPN Access', description: 'Remote access for contractors' },
  },
  membershipType: 'RULE_BASED',
  rules: [contractorRule],
  attribution: 'exact',
};

/** Shared, application-managed — a rule-based membership no group rule explains. */
const appGroupMembership: GroupMembership = {
  group: {
    id: '00gFAKEgroup0002',
    type: 'APP_GROUP',
    profile: { name: 'Salesforce Users', description: 'Mastered by Salesforce' },
  },
  membershipType: 'RULE_BASED',
  rules: [],
  attribution: 'exact',
};

/** Context-only, with a candidate set no evidence separates. */
const ambiguousMembership: GroupMembership = {
  group: {
    id: '00gFAKEgroup0003',
    type: 'OKTA_GROUP',
    profile: { name: 'Finance Approvers' },
  },
  membershipType: 'RULE_BASED',
  rules: [legacyRuleA, legacyRuleB],
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
      onlyCompared: [ruleBasedMembership],
      shared: [appGroupMembership],
      onlyContext: [ambiguousMembership],
    },
    appBuckets: {
      onlyCompared: [{ id: 'app2', label: 'Salesforce', scope: 'USER' as const }],
      shared: [{ id: 'app1', label: 'Slack' }],
      onlyContext: [{ id: 'app3', label: 'Figma' }],
    },
    groupDiffCount: 2,
    appDiffCount: 2,
    groupSimilarity: 33,
    appSimilarity: 33,
    overallSimilarity: 33,
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

/** The single props object the diff tab was rendered with. */
function renderDiffTab(over: Partial<UserComparisonState> = {}): Record<string, unknown> {
  render(<UserComparisonView contextUser={contextUser} comparison={comparison(over)} />);
  expect(diffTabProps.length).toBeGreaterThan(0);
  return diffTabProps[diffTabProps.length - 1];
}

/**
 * The rows the diff tab was handed, filtered to the side that used to be a
 * bucket. `ComparisonDiffTab` now takes ONE union list of {@link ParityRow}s
 * instead of three arrays, so the old `comparedItems`/`sharedItems`/
 * `contextItems` props are read back out of `rows` here. This is an accessor
 * change: every assertion below still asserts exactly what it did before.
 */
const bucket = (props: Record<string, unknown>, key: string): ParityRow[] => {
  const rows = props.rows as ParityRow[];
  if (key === 'comparedItems') return rows.filter((r) => r.inCompared && !r.inContext);
  if (key === 'contextItems') return rows.filter((r) => r.inContext && !r.inCompared);
  return rows.filter((r) => r.inContext && r.inCompared);
};

beforeEach(() => {
  diffTabProps.length = 0;
});

// ================================================================== tests

describe('UserComparisonView — groups tab provenance', () => {
  it('hands every bucket rows that still carry membershipType, rules and attribution', () => {
    const props = renderDiffTab();

    const [compared] = bucket(props, 'comparedItems');
    expect(compared.id).toBe('00gFAKEgroup0001');
    expect(compared.label).toBe('VPN Access');
    expect(compared.membership).toBe(ruleBasedMembership);
    expect(compared.membership?.membershipType).toBe('RULE_BASED');
    expect(compared.membership?.rules.map((r) => r.id)).toEqual(['0prFAKErule00001']);
    expect(compared.membership?.attribution).toBe('exact');

    const [shared] = bucket(props, 'sharedItems');
    expect(shared.membership).toBe(appGroupMembership);
    expect(shared.membership?.rules).toEqual([]);
    expect(shared.membership?.attribution).toBe('exact');

    const [context] = bucket(props, 'contextItems');
    expect(context.membership).toBe(ambiguousMembership);
    expect(context.membership?.attribution).toBe('ambiguous');
    // The whole candidate set arrives — 3.7 must be able to see that two rules
    // are in play before deciding it may name neither.
    expect(context.membership?.rules.map((r) => r.id)).toEqual([
      '0prFAKErule00002',
      '0prFAKErule00003',
    ]);
  });

  it('keeps group.type and the description, which the old id+label projection dropped', () => {
    const props = renderDiffTab();

    expect(bucket(props, 'comparedItems')[0].membership?.group.type).toBe('OKTA_GROUP');
    expect(bucket(props, 'comparedItems')[0].membership?.group.profile.description).toBe(
      'Remote access for contractors',
    );
    expect(bucket(props, 'sharedItems')[0].membership?.group.type).toBe('APP_GROUP');
    expect(bucket(props, 'sharedItems')[0].membership?.group.profile.description).toBe(
      'Mastered by Salesforce',
    );
  });

  it('still renders the groups tab with its copy affordances and group noun', () => {
    const props = renderDiffTab();

    expect(props.noun).toBe('group');
    // `renderAction` split into two directional props when the row became
    // symmetric; both copy directions are still offered.
    expect(typeof props.renderContextAction).toBe('function');
    expect(typeof props.renderComparedAction).toBe('function');
  });
});

describe('UserComparisonView — apps tab is unaffected', () => {
  it('hands the apps tab bare id/label rows, with no membership on any of them', () => {
    const props = renderDiffTab({ activeTab: 'apps' });

    for (const key of ['comparedItems', 'sharedItems', 'contextItems']) {
      for (const item of bucket(props, key)) {
        expect(Object.keys(item).sort()).toEqual(['id', 'inCompared', 'inContext', 'label']);
        expect(item.membership).toBeUndefined();
      }
    }

    expect(bucket(props, 'comparedItems')).toEqual([
      { id: 'app2', label: 'Salesforce', inContext: false, inCompared: true },
    ]);
    expect(bucket(props, 'sharedItems')).toEqual([
      { id: 'app1', label: 'Slack', inContext: true, inCompared: true },
    ]);
    expect(bucket(props, 'contextItems')).toEqual([
      { id: 'app3', label: 'Figma', inContext: true, inCompared: false },
    ]);
  });

  it('still renders the apps tab with the app noun and no copy affordances', () => {
    const props = renderDiffTab({ activeTab: 'apps' });

    expect(props.noun).toBe('app');
    expect(props.renderContextAction).toBeUndefined();
    expect(props.renderComparedAction).toBeUndefined();
  });
});
