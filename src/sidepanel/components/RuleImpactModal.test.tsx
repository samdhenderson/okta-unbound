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
    profile: {
      login: `${id}@example.com`,
      email: `${id}@example.com`,
      firstName: first,
      lastName: 'U',
    },
  };
}

const summary: RuleImpactSummary = {
  ruleId: 'r1',
  ruleName: 'Engineering',
  distinctMemberCount: 3,
  totalHeldSolely: 2,
  targetGroups: [
    {
      groupId: 'g1',
      groupName: 'Eng All',
      memberCount: 3,
      heldSolelyCount: 2,
      heldSolelyByRule: [member('u1', 'Ada'), member('u2', 'Bea')],
    },
    {
      groupId: 'g2',
      groupName: 'Eng Leads',
      memberCount: 1,
      heldSolelyCount: 0,
      heldSolelyByRule: [],
    },
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
  it('shows the summary tiles and per-group breakdown when done', () => {
    render(<RuleImpactModal {...baseProps} mode="preview" />);
    // Summary metric tiles.
    expect(screen.getByText('Held by this rule alone')).toBeInTheDocument();
    expect(screen.getByText('Current members')).toBeInTheDocument();
    // Per-group breakdown.
    expect(screen.getByText('Eng All')).toBeInTheDocument();
    expect(screen.getByText('2 held by this rule alone')).toBeInTheDocument();
    // The group nothing is solely held in is labeled "No change".
    expect(screen.getByText('No change')).toBeInTheDocument();
  });

  it('expands a group to list the members it holds up alone', async () => {
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
    // D-081: the error is announced via the shared AlertMessage's role="alert",
    // not silently swapped in as a plain <div> a screen reader never hears.
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to fetch group rules');
  });

  it('deep-links a target group to the Groups tab when navigation is wired (B → A2)', async () => {
    const onNavigateToGroup = vi.fn();
    render(<RuleImpactModal {...baseProps} mode="preview" onNavigateToGroup={onNavigateToGroup} />);
    // The group-name button (starts with the name) navigates; the expand toggle
    // (aria-label starts with "Show") does not.
    await userEvent.click(screen.getByRole('button', { name: /^Eng All/ }));
    expect(onNavigateToGroup).toHaveBeenCalledWith('g1');
  });

  /**
   * D-052: Okta does not retract membership on deactivate. The modal must say so
   * rather than reporting the solely-held population as an access loss.
   */
  it('deactivate mode says nobody is removed, never that members lose access', () => {
    render(<RuleImpactModal {...baseProps} mode="deactivate" onConfirmDeactivate={() => {}} />);
    expect(screen.getByText(/Nobody is removed from a group/)).toBeInTheDocument();
    expect(screen.queryByText(/lose access/)).not.toBeInTheDocument();
  });

  /** Preview mode is equally forbidden from pinning removal on deactivation. */
  it('preview mode attributes removal to delete, not to deactivation', () => {
    render(<RuleImpactModal {...baseProps} mode="preview" />);
    expect(screen.getByText(/Deactivating it removes nobody/)).toBeInTheDocument();
    expect(screen.getByText(/Only deleting the rule can remove them/)).toBeInTheDocument();
    expect(screen.queryByText(/lose access/)).not.toBeInTheDocument();
  });

  it('reports nobody solely held cleanly', () => {
    render(
      <RuleImpactModal
        {...baseProps}
        mode="preview"
        summary={{
          ...summary,
          totalHeldSolely: 0,
          targetGroups: [
            {
              groupId: 'g2',
              groupName: 'Eng Leads',
              memberCount: 1,
              heldSolelyCount: 0,
              heldSolelyByRule: [],
            },
          ],
        }}
      />,
    );
    // No solely-held badge, and every group reads "No change".
    expect(screen.queryByText(/^\d+ held by this rule alone$/)).not.toBeInTheDocument();
    expect(screen.getByText('No change')).toBeInTheDocument();
  });
});
