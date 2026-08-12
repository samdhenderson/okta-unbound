import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupMembershipSourceSection from './GroupMembershipSourceSection';
import type { MemberSourceBreakdown } from '../../../../shared/membership/groupSource';

const breakdown: MemberSourceBreakdown = {
  total: 4,
  direct: 1,
  ruleBased: 3,
  unattributed: 0,
  byRule: [{ ruleId: 'r1', ruleName: 'All Engineers', count: 3 }],
};

const base = {
  memberCount: 4,
  breakdown: null,
  status: 'idle' as const,
  error: null,
  onAnalyze: () => {},
};

describe('GroupMembershipSourceSection', () => {
  it('gates the analysis behind a button and states what it costs', () => {
    render(<GroupMembershipSourceSection {...base} />);

    expect(screen.getByRole('button', { name: 'Analyze' })).toBeInTheDocument();
    expect(screen.getByText(/Reads all 4 members once/)).toBeInTheDocument();
  });

  it('runs the analysis on click', async () => {
    const onAnalyze = vi.fn();
    render(<GroupMembershipSourceSection {...base} onAnalyze={onAnalyze} />);

    await userEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    expect(onAnalyze).toHaveBeenCalledTimes(1);
  });

  it('disables the gate when no Okta tab is connected', () => {
    render(<GroupMembershipSourceSection {...base} canAnalyze={false} />);
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeDisabled();
  });

  it('offers no analysis for an empty group', () => {
    render(<GroupMembershipSourceSection {...base} memberCount={0} />);

    expect(screen.queryByRole('button', { name: 'Analyze' })).not.toBeInTheDocument();
    expect(screen.getByText(/no members, so there is nothing to attribute/)).toBeInTheDocument();
  });

  it('shows a spinner while analyzing', () => {
    render(<GroupMembershipSourceSection {...base} status="loading" />);
    expect(screen.getByText('Analyzing members…')).toBeInTheDocument();
  });

  it('shows a dismissible danger alert with a retry on failure', async () => {
    const onAnalyze = vi.fn();
    render(
      <GroupMembershipSourceSection
        {...base}
        status="error"
        error="Members could not be read"
        onAnalyze={onAnalyze}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Members could not be read');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onAnalyze).toHaveBeenCalledTimes(1);
  });

  it('renders the meter buckets as readable text, not just a bar', () => {
    render(<GroupMembershipSourceSection {...base} status="done" breakdown={breakdown} />);

    expect(screen.getByText('Rule-managed')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.getByText('(75%)')).toBeInTheDocument();
    expect(screen.getByText('(25%)')).toBeInTheDocument();
  });

  it('omits an empty bucket from the meter', () => {
    render(
      <GroupMembershipSourceSection
        {...base}
        status="done"
        breakdown={{ ...breakdown, direct: 0, total: 3 }}
      />,
    );

    expect(screen.getByText('Rule-managed')).toBeInTheDocument();
    expect(screen.queryByText('Manual')).not.toBeInTheDocument();
    expect(screen.queryByText('Indeterminate')).not.toBeInTheDocument();
  });

  it('surfaces the third bucket once the classifier reports it', () => {
    render(
      <GroupMembershipSourceSection
        {...base}
        status="done"
        breakdown={{ ...breakdown, unattributed: 1, total: 5 }}
      />,
    );

    expect(screen.getByText('Indeterminate')).toBeInTheDocument();
  });

  it('lists each rule contribution and deep-links it', async () => {
    const onNavigateToRule = vi.fn();
    render(
      <GroupMembershipSourceSection
        {...base}
        status="done"
        breakdown={breakdown}
        onNavigateToRule={onNavigateToRule}
      />,
    );

    expect(screen.getByText('3 members')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Open rule All Engineers in the Rules tab' }),
    );
    expect(onNavigateToRule).toHaveBeenCalledWith('r1');
  });

  it('distinguishes an Okta-attributed rule from one the heuristic only inferred', () => {
    render(
      <GroupMembershipSourceSection
        {...base}
        status="done"
        breakdown={{
          total: 4,
          direct: 0,
          ruleBased: 4,
          unattributed: 0,
          byRule: [
            { ruleId: 'r1', ruleName: 'All Engineers', count: 3 },
            { ruleId: 'r2', ruleName: 'Contractors', count: 1 },
          ],
          byRuleMembers: [
            {
              ruleId: 'r1',
              ruleName: 'All Engineers',
              soleCount: 3,
              oktaAttributedCount: 3,
              clientAttributedCount: 0,
            },
            {
              ruleId: 'r2',
              ruleName: 'Contractors',
              soleCount: 1,
              oktaAttributedCount: 0,
              clientAttributedCount: 1,
            },
          ],
          multiRuleMembers: 0,
        }}
      />,
    );

    // A fact and a deduction must not read with the same weight.
    const fact = screen.getByText('Okta-attributed');
    const guess = screen.getByText('Inferred');
    expect(fact).toBeInTheDocument();
    expect(guess).toHaveAttribute('title', expect.stringContaining('deduction, not a fact'));
    expect(fact.className).not.toBe(guess.className);
  });

  it('renders one meter segment per rule, plus the shared-member segment', () => {
    render(
      <GroupMembershipSourceSection
        {...base}
        memberCount={70}
        status="done"
        breakdown={{
          total: 70,
          direct: 1,
          ruleBased: 69,
          unattributed: 0,
          byRule: [{ ruleId: 'r1', ruleName: 'All Engineers', count: 69 }],
          byRuleMembers: [
            {
              ruleId: 'r1',
              ruleName: 'All Engineers',
              soleCount: 68,
              oktaAttributedCount: 69,
              clientAttributedCount: 0,
            },
          ],
          multiRuleMembers: 1,
        }}
      />,
    );

    // "All Engineers" appears twice: once as a meter segment, once as a rule row.
    expect(screen.getAllByText('All Engineers').length).toBeGreaterThan(1);
    expect(screen.getByText('Matched by 2+ rules')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.queryByText('Rule-managed')).not.toBeInTheDocument();
  });

  it('says so when no member could be attributed to a rule', () => {
    render(
      <GroupMembershipSourceSection
        {...base}
        status="done"
        breakdown={{ total: 4, direct: 4, ruleBased: 0, unattributed: 0, byRule: [] }}
      />,
    );

    expect(screen.getByText('No member was attributed to a specific rule.')).toBeInTheDocument();
  });
});
