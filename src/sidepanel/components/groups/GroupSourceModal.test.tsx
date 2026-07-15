import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupSourceModal from './GroupSourceModal';
import type { GroupSummary } from '../../../shared/types';
import type { MemberSourceBreakdown } from '../../../shared/membership/groupSource';

function group(over: Partial<GroupSummary> = {}): GroupSummary {
  return {
    id: 'g1',
    name: 'Engineering',
    type: 'OKTA_GROUP',
    memberCount: 12,
    hasRules: false,
    ruleCount: 0,
    ...over,
  };
}

const base = {
  group: group(),
  feedingRules: [{ id: 'r1', name: 'Eng feeder', status: 'ACTIVE' }],
  rulesStatus: 'done' as const,
  breakdown: null as MemberSourceBreakdown | null,
  memberStatus: 'idle' as const,
  error: null,
  onClose: () => {},
  onAnalyzeMembers: () => {},
};

describe('GroupSourceModal', () => {
  it('lists feeding rules with their status', () => {
    render(<GroupSourceModal {...base} />);
    expect(screen.getByText('Eng feeder')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('states plainly when nothing feeds the group', () => {
    render(<GroupSourceModal {...base} feedingRules={[]} />);
    expect(screen.getByText(/No group rules assign users to this group/i)).toBeInTheDocument();
  });

  it('shows app-push targets when present', () => {
    render(
      <GroupSourceModal
        {...base}
        group={group({
          pushMappings: [
            {
              mappingId: 'm1',
              sourceUserGroupId: 'g1',
              targetGroupName: 'X',
              status: 'ACTIVE',
              appId: 'a1',
              appName: 'Salesforce',
            },
          ],
        })}
      />,
    );
    expect(screen.getByText('Salesforce')).toBeInTheDocument();
  });

  it('triggers the gated member analysis', async () => {
    const onAnalyzeMembers = vi.fn();
    render(<GroupSourceModal {...base} onAnalyzeMembers={onAnalyzeMembers} />);
    await userEvent.click(screen.getByRole('button', { name: /Analyze 12 members/ }));
    expect(onAnalyzeMembers).toHaveBeenCalledTimes(1);
  });

  it('renders the manual-vs-rule breakdown once analyzed', () => {
    render(
      <GroupSourceModal
        {...base}
        memberStatus="done"
        breakdown={{
          total: 12,
          direct: 4,
          ruleBased: 8,
          byRule: [{ ruleId: 'r1', ruleName: 'Eng feeder', count: 8 }],
        }}
      />,
    );
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.getByText('Rule-managed')).toBeInTheDocument();
    expect(screen.getByText('8 members')).toBeInTheDocument();
  });

  it('renders nothing when no group is open', () => {
    const { container } = render(<GroupSourceModal {...base} group={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
