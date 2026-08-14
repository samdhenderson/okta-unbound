import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ComparisonOverviewTab from './ComparisonOverviewTab';
import type { AccessCause } from './accessCause';
import type { GroupBuckets } from './comparisonAnalytics';
import { mockGroup } from '../../../../test/mocks/fixtures';
import type { GroupMembership } from '../../../../shared/types';

/**
 * Phase 3.7 — the overview tab gains the cause worklist.
 *
 * The two proportion cards are the pre-existing contract and must survive the
 * addition untouched; `causes` is additive and optional, and absent must not read
 * as "there is nothing to fix".
 */

const membership = (id: string, name: string): GroupMembership => ({
  group: { ...mockGroup, id, profile: { ...mockGroup.profile, name } },
  membershipType: 'DIRECT',
  rules: [],
  attribution: 'exact',
});

const groupBuckets: GroupBuckets = {
  onlyCompared: [membership('g1', 'Engineering')],
  shared: [membership('g2', 'All Employees')],
  onlyContext: [membership('g3', 'Finance')],
};

const baseProps = {
  contextName: 'Jane Doe',
  comparedName: 'John Smith',
  groupBuckets,
  appBuckets: {
    onlyCompared: [{ id: 'a1', label: 'Salesforce' }],
    shared: [{ id: 'a2', label: 'Slack' }],
    onlyContext: [],
  },
  groupSimilarity: 33,
  appSimilarity: 50,
  onJumpToGroups: vi.fn(),
  onJumpToApps: vi.fn(),
};

const causes: AccessCause[] = [
  {
    groupId: '00gFAKE1',
    groupName: 'Engineering',
    remedy: 'blocked-by-attribute',
    ruleId: '0prFAKE1',
    ruleName: 'Platform engineers',
    failingClauses: [
      { expressionText: 'user.department == "Platform"', resolvedValue: 'Support', status: 'fail' },
    ],
  },
  {
    groupId: '00gFAKE2',
    groupName: 'VPN Access',
    remedy: 'cannot-determine',
    undeterminedReason: 'ambiguous-attribution',
    failingClauses: [],
  },
];

describe('ComparisonOverviewTab', () => {
  it('still renders both proportion cards and their jump links', async () => {
    const onJumpToGroups = vi.fn();
    const onJumpToApps = vi.fn();
    render(
      <ComparisonOverviewTab
        {...baseProps}
        onJumpToGroups={onJumpToGroups}
        onJumpToApps={onJumpToApps}
        causes={causes}
      />,
    );

    expect(screen.getByText('Group memberships')).toBeInTheDocument();
    expect(screen.getByText('App assignments')).toBeInTheDocument();
    expect(screen.getByText('3 total · 33% overlap')).toBeInTheDocument();
    expect(screen.getByText('2 total · 50% overlap')).toBeInTheDocument();

    const links = screen.getAllByRole('button', { name: /View details/ });
    expect(links).toHaveLength(2);
    await userEvent.click(links[0]);
    expect(onJumpToGroups).toHaveBeenCalled();
    await userEvent.click(links[1]);
    expect(onJumpToApps).toHaveBeenCalled();
  });

  it('renders the worklist grouped by remedy, keeping cannot-determine separate', () => {
    render(<ComparisonOverviewTab {...baseProps} causes={causes} />);

    expect(screen.getByRole('heading', { name: 'Fix a profile attribute' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Needs investigation' })).toBeInTheDocument();
    expect(screen.getByText(/More than one rule could account/)).toBeInTheDocument();
  });

  it('distinguishes absent causes from computed-and-empty causes', () => {
    const { unmount } = render(<ComparisonOverviewTab {...baseProps} />);
    expect(screen.getByText('Causes not computed')).toBeInTheDocument();
    expect(screen.queryByText('No access differences to explain')).not.toBeInTheDocument();
    unmount();

    render(<ComparisonOverviewTab {...baseProps} causes={[]} />);
    expect(screen.getByText('No access differences to explain')).toBeInTheDocument();
    expect(screen.queryByText('Causes not computed')).not.toBeInTheDocument();
  });

  it('forwards the clause-checklist deep link to the host', async () => {
    const onViewClauses = vi.fn();
    render(<ComparisonOverviewTab {...baseProps} causes={causes} onViewClauses={onViewClauses} />);

    await userEvent.click(screen.getAllByRole('button', { name: 'Open clause checklist' })[0]);
    expect(onViewClauses).toHaveBeenCalledWith(causes[0]);
  });
});
