/**
 * @module sidepanel/components/groups/detail/GroupDetailView.test
 * @description Tests for the Group Detail view's tab shell.
 *
 * Pins the container's own job — composing the read-only loads, the action bar,
 * and which of the four tabbed panes is on screen — not the panes' own
 * rendering, which each already has its own suite
 * (`GroupMembershipSourceSection.test.tsx`, `GroupMembersSection.test.tsx`,
 * `GroupRulesSection.test.tsx`; `GroupOverviewPane`, `GroupAccessSection` and
 * `GroupPushSection` are pure-render leaves with only a story, per ADR-0023).
 * Every pane, the action bar's modal, and `GroupMetadataSection` are stubbed
 * test doubles here so a tab switch reads as "which stub is mounted" — the
 * same pattern `GroupsTab.test.tsx` uses for its feature children.
 *
 * `GroupActionBar` is rendered for real: it is a pure-render leaf with no
 * hooks of its own, and "Export omitted/present, Add wired" is exactly the
 * kind of user-visible behavior a mock would hide.
 *
 * The five loading hooks (`useGroupSource`, `useGroupRuleReferences`,
 * `useGroupAccessGrants`, `useGroupMembersSection`, `useAddGroupMember`) are
 * mocked at the hook boundary — the established pattern for a container test,
 * e.g. `UserComparisonPanel.scroll.test.tsx`'s `useUserComparison` mock. The one
 * exception is `useOwedLoad`, left real, because the `autoAnalyze` coverage
 * below is exactly about the gating it provides.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupDetailView from './GroupDetailView';
import type { GroupSummary } from '../../../../shared/types';

// ---------------------------------------------------------------------------
// Hook test doubles
// ---------------------------------------------------------------------------
const groupSource = vi.hoisted(() => ({
  open: vi.fn(),
  analyzeMembers: vi.fn(),
  resummarize: vi.fn(),
  group: null as { id: string } | null,
  feedingRules: [] as unknown[],
  rulesStatus: 'idle' as const,
  breakdown: null as unknown,
  memberStatus: 'idle' as const,
  error: null as string | null,
}));

vi.mock('../../../hooks/useGroupSource', () => ({
  useGroupSource: () => groupSource,
}));

vi.mock('../../../hooks/useGroupRuleReferences', () => ({
  useGroupRuleReferences: () => ({
    rules: [],
    status: 'idle',
    error: null,
  }),
}));

vi.mock('../../../hooks/useGroupAccessGrants', () => ({
  useGroupAccessGrants: () => ({
    apps: [],
    appsStatus: 'idle',
    appsError: null,
    roles: [],
    rolesStatus: 'available',
  }),
}));

const membersSectionState = vi.hoisted(() => ({
  members: null as unknown,
  removeTarget: null,
  requestRemove: vi.fn(),
  cancelRemove: vi.fn(),
  confirmRemove: vi.fn(),
  removeStatus: 'idle' as const,
  removeError: null as string | null,
  addQuery: '',
  setAddQuery: vi.fn(),
  addResults: [] as unknown[],
  isSearchingToAdd: false,
  addSearchError: null as string | null,
  selectToAdd: vi.fn(),
  addStatus: 'idle' as const,
  addError: null as string | null,
  onMemberAdded: vi.fn(),
}));

vi.mock('./useGroupMembersSection', () => ({
  useGroupMembersSection: () => membersSectionState,
}));

const addMember = vi.hoisted(() => ({
  isOpen: false,
  addQuery: '',
  setAddQuery: vi.fn(),
  addResults: [] as unknown[],
  isSearchingToAdd: false,
  addSearchError: null as string | null,
  selectedUser: null,
  selectUser: vi.fn(),
  clearSelectedUser: vi.fn(),
  isAddingMember: false,
  openModal: vi.fn(),
  closeModal: vi.fn(),
  confirmAddMember: vi.fn(),
  addMemberDirect: vi.fn(),
}));

vi.mock('../../../hooks/useAddGroupMember', () => ({
  useAddGroupMember: () => addMember,
}));

// ---------------------------------------------------------------------------
// Section test doubles — each renders one identifiable node so a tab switch
// reads as "which stub is mounted", not a rendered section's own internals.
// ---------------------------------------------------------------------------
vi.mock('./GroupOverviewPane', () => ({
  default: () => <div data-testid="stub-overview" />,
}));
vi.mock('./GroupMembershipSourceSection', () => ({
  default: () => <div data-testid="stub-membership-source" />,
}));
vi.mock('./GroupMembersSection', () => ({
  default: () => <div data-testid="stub-members" />,
}));
vi.mock('./GroupAccessSection', () => ({
  default: () => <div data-testid="stub-access" />,
}));
vi.mock('./GroupRulesSection', () => ({
  default: () => <div data-testid="stub-rules" />,
}));
vi.mock('./GroupPushSection', () => ({
  default: () => <div data-testid="stub-push" />,
}));
vi.mock('./GroupMetadataSection', () => ({
  default: () => <div data-testid="stub-metadata" />,
}));
vi.mock('./AddGroupMemberModal', () => ({
  default: () => <div data-testid="stub-add-modal" />,
}));

// ---------------------------------------------------------------------------
// Fixture — obviously fake id only.
// ---------------------------------------------------------------------------
function makeGroup(over: Partial<GroupSummary> = {}): GroupSummary {
  return {
    id: '00gFAKEgroup00001',
    name: 'Engineering',
    description: 'Eng team',
    type: 'OKTA_GROUP',
    memberCount: 10,
    hasRules: false,
    ruleCount: 0,
    ...over,
  };
}

describe('GroupDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    groupSource.group = null;
    groupSource.memberStatus = 'idle';
  });

  it('defaults to the Overview tab, rendering the overview pane and hiding every other pane', () => {
    render(<GroupDetailView group={makeGroup()} targetTabId={1} />);

    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('stub-overview')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-membership-source')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-members')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-access')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-push')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-rules')).not.toBeInTheDocument();
    // Outside the tab card — GroupMetadataSection's position is unchanged by
    // this step, so it renders regardless of which pane is active.
    expect(screen.getByTestId('stub-metadata')).toBeInTheDocument();
  });

  it('switches to the Members tab, rendering its two sections and unmounting Overview', async () => {
    const user = userEvent.setup();
    render(<GroupDetailView group={makeGroup()} targetTabId={1} />);

    await user.click(screen.getByRole('tab', { name: 'Members' }));

    expect(screen.getByRole('tab', { name: 'Members' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('stub-membership-source')).toBeInTheDocument();
    expect(screen.getByTestId('stub-members')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-overview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-access')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-push')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-rules')).not.toBeInTheDocument();
    expect(screen.getByTestId('stub-metadata')).toBeInTheDocument();
  });

  it('switches to the Access tab, rendering Access + Push and unmounting Overview/Members', async () => {
    const user = userEvent.setup();
    render(<GroupDetailView group={makeGroup()} targetTabId={1} />);

    await user.click(screen.getByRole('tab', { name: 'Access' }));

    expect(screen.getByRole('tab', { name: 'Access' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('stub-access')).toBeInTheDocument();
    expect(screen.getByTestId('stub-push')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-overview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-membership-source')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-members')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-rules')).not.toBeInTheDocument();
    expect(screen.getByTestId('stub-metadata')).toBeInTheDocument();
  });

  it('switches to the Rules tab, rendering Rules and unmounting everything else', async () => {
    const user = userEvent.setup();
    render(<GroupDetailView group={makeGroup()} targetTabId={1} />);

    await user.click(screen.getByRole('tab', { name: 'Rules' }));

    expect(screen.getByRole('tab', { name: 'Rules' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('stub-rules')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-overview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-membership-source')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-members')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-access')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-push')).not.toBeInTheDocument();
  });

  it('exposes exactly the four tabs, in order', () => {
    render(<GroupDetailView group={makeGroup()} targetTabId={1} />);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Overview',
      'Members',
      'Access',
      'Rules',
    ]);
  });

  it('omits Export members from the action bar when onExportGroup is not provided (ADR-0039)', () => {
    render(<GroupDetailView group={makeGroup()} targetTabId={1} />);
    expect(screen.queryByRole('button', { name: /export members/i })).not.toBeInTheDocument();
  });

  it('shows Export members and wires it to onExportGroup when provided', async () => {
    const user = userEvent.setup();
    const onExportGroup = vi.fn();
    const group = makeGroup();
    render(<GroupDetailView group={group} targetTabId={1} onExportGroup={onExportGroup} />);

    await user.click(screen.getByRole('button', { name: /export members/i }));
    expect(onExportGroup).toHaveBeenCalledWith(group.id, group.name);
  });

  it("wires the action bar's Add button to the Add-member modal", async () => {
    const user = userEvent.setup();
    render(<GroupDetailView group={makeGroup()} targetTabId={1} />);

    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(addMember.openModal).toHaveBeenCalledTimes(1);
  });

  it('fires the gated member-source analysis exactly once when autoAnalyze is set and the open has landed', () => {
    const group = makeGroup();
    groupSource.group = { id: group.id };

    const { rerender } = render(
      <GroupDetailView group={group} targetTabId={1} autoAnalyze isActive />,
    );
    expect(groupSource.analyzeMembers).toHaveBeenCalledTimes(1);

    // A re-render with the same group identity — including a visibility
    // round trip — must not re-fire the once-per-group latch.
    rerender(<GroupDetailView group={group} targetTabId={1} autoAnalyze isActive={false} />);
    rerender(<GroupDetailView group={group} targetTabId={1} autoAnalyze isActive />);
    expect(groupSource.analyzeMembers).toHaveBeenCalledTimes(1);

    // It lands where the result is visible: `autoAnalyze` picks Members as the
    // initial tab instead of the plain-drill-in default of Overview (see that
    // prop's doc on `GroupDetailView`).
    expect(screen.getByRole('tab', { name: 'Members' })).toHaveAttribute('aria-selected', 'true');
  });

  it('never auto-analyzes when autoAnalyze is unset (a plain drill-in), and lands on Overview', () => {
    const group = makeGroup();
    groupSource.group = { id: group.id };
    render(<GroupDetailView group={group} targetTabId={1} />);
    expect(groupSource.analyzeMembers).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  });
});
