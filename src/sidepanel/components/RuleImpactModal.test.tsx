import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RuleImpactModal from './RuleImpactModal';
import type { RuleImpactSummary } from '../../shared/membership/ruleImpact';
import type { OktaUser } from '../../shared/types';

function member(id: string, first: string): OktaUser {
  return {
    id,
    status: 'ACTIVE',
    profile: { login: `${id}@x.io`, email: `${id}@x.io`, firstName: first, lastName: 'U' },
  };
}

const summary: RuleImpactSummary = {
  ruleId: 'r1',
  ruleName: 'Engineering',
  distinctMemberCount: 3,
  totalLosing: 2,
  targetGroups: [
    {
      groupId: 'g1',
      groupName: 'Eng All',
      memberCount: 3,
      losingCount: 2,
      losing: [member('u1', 'Ada'), member('u2', 'Bea')],
    },
    { groupId: 'g2', groupName: 'Eng Leads', memberCount: 1, losingCount: 0, losing: [] },
  ],
};

const baseProps = {
  isOpen: true,
  ruleName: 'Engineering',
  status: 'done' as const,
  summary,
  error: null,
  progress: null,
  onClose: () => {},
};

describe('RuleImpactModal', () => {
  it('shows a loss headline and per-group breakdown when done', () => {
    render(<RuleImpactModal {...baseProps} mode="preview" />);
    expect(screen.getByText('2 users would lose access')).toBeInTheDocument();
    expect(screen.getByText('Eng All')).toBeInTheDocument();
    expect(screen.getByText('2 lose access')).toBeInTheDocument();
    // The group with no loss is labeled "No change".
    expect(screen.getByText('No change')).toBeInTheDocument();
  });

  it('expands a group to list the members who would lose access', async () => {
    render(<RuleImpactModal {...baseProps} mode="preview" />);
    // Members are hidden until the group row is expanded.
    expect(screen.queryByText('Ada U')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Eng All/ }));
    expect(screen.getByText('Ada U')).toBeInTheDocument();
    expect(screen.getByText('Bea U')).toBeInTheDocument();
  });

  it('preview mode has no deactivate action', () => {
    render(<RuleImpactModal {...baseProps} mode="preview" />);
    expect(screen.queryByRole('button', { name: 'Deactivate rule' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('deactivate mode confirms through the danger action', async () => {
    const onConfirmDeactivate = vi.fn();
    render(
      <RuleImpactModal
        {...baseProps}
        mode="deactivate"
        onConfirmDeactivate={onConfirmDeactivate}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate rule' }));
    expect(onConfirmDeactivate).toHaveBeenCalledTimes(1);
  });

  it('disables the deactivate action while the analysis is still loading', () => {
    render(
      <RuleImpactModal
        {...baseProps}
        status="loading"
        summary={null}
        progress={{ current: 1, total: 2, message: 'Loading members for Eng All…' }}
        mode="deactivate"
        onConfirmDeactivate={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Deactivate rule' })).toBeDisabled();
    expect(screen.getByText('Loading members for Eng All…')).toBeInTheDocument();
  });

  it('surfaces an error state', () => {
    render(
      <RuleImpactModal
        {...baseProps}
        status="error"
        summary={null}
        error="Failed to fetch group rules"
        mode="preview"
      />,
    );
    expect(screen.getByText('Failed to fetch group rules')).toBeInTheDocument();
  });

  it('reports zero loss cleanly', () => {
    render(
      <RuleImpactModal
        {...baseProps}
        mode="preview"
        summary={{
          ...summary,
          totalLosing: 0,
          targetGroups: [
            { groupId: 'g2', groupName: 'Eng Leads', memberCount: 1, losingCount: 0, losing: [] },
          ],
        }}
      />,
    );
    expect(screen.getByText('No users would lose access')).toBeInTheDocument();
  });
});
