/**
 * @module sidepanel/components/groups/detail/GroupDetailView.test
 * @description Tests for the Group Detail view's tab shell.
 *
 * Pins the container's own job — composing the read-only loads, the action bar,
 * and which of the five tabbed panes is on screen — not the panes' own
 * rendering, which each already has its own suite
 * (`GroupMembersSection.test.tsx`,
 * `GroupRulesSection.test.tsx`; `GroupOverviewPane`, `GroupAccessSection`,
 * `GroupPushSection` and `GroupInsightsPane` are pure-render leaves with only a
 * story, per ADR-0023). Every pane (including `GroupInsightsPane`, which now
 * owns the folded `GroupMetadataSection` internally — see that pane's own
 * module doc) and the action bar's modal are stubbed test doubles here so a
 * tab switch reads as "which stub is mounted" — the same pattern
 * `GroupsTab.test.tsx` uses for its feature children.
 *
 * `GroupActionBar` is rendered for real: it is a pure-render leaf with no
 * hooks of its own, and "Export omitted/present, Add wired" is exactly the
 * kind of user-visible behavior a mock would hide.
 *
 * The six loading hooks (`useGroupSource`, `useGroupRuleReferences`,
 * `useGroupAccessGrants`, `useMemberMfaScan`, `useGroupMembersSection`,
 * `useAddGroupMember`) are mocked at the hook boundary — the established
 * pattern for a container test, e.g. `UserComparisonPanel.scroll.test.tsx`'s
 * `useUserComparison` mock. The one exception is `useOwedLoad`, left real,
 * because the `autoAnalyze` coverage below is exactly about the gating it
 * provides.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

const mfaScan = vi.hoisted(() => ({
  mfaResults: null as unknown,
  scanStatus: 'idle' as const,
  runScan: vi.fn(),
  requestConfirm: vi.fn(),
  cancelConfirm: vi.fn(),
}));

vi.mock('../../../hooks/useMemberMfaScan', () => ({
  useMemberMfaScan: () => mfaScan,
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
vi.mock('./GroupInsightsPane', () => ({
  default: () => <div data-testid="stub-insights" />,
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
    expect(screen.queryByTestId('stub-members')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-access')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-push')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-rules')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-insights')).not.toBeInTheDocument();
  });

  /*
    One section, not two. `GroupMembershipSourceSection` is gone: it rendered a
    second card, a second gate and a second idle/loading/error ladder over the
    *same* `useGroupSource` state this pane reads, so a reader could load the
    roster and still be looking at an un-analyzed meter. Its readout is the strip
    inside the roster now, and its commentary is `MemberSourceNotes`.
  */
  it('switches to the Members tab, rendering its one section and unmounting Overview', async () => {
    const user = userEvent.setup();
    render(<GroupDetailView group={makeGroup()} targetTabId={1} />);

    await user.click(screen.getByRole('tab', { name: 'Members' }));

    expect(screen.getByRole('tab', { name: 'Members' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('stub-members')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-overview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-access')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-push')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-rules')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-insights')).not.toBeInTheDocument();
  });

  it('switches to the Access tab, rendering Access + Push and unmounting Overview/Members', async () => {
    const user = userEvent.setup();
    render(<GroupDetailView group={makeGroup()} targetTabId={1} />);

    await user.click(screen.getByRole('tab', { name: 'Access' }));

    expect(screen.getByRole('tab', { name: 'Access' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('stub-access')).toBeInTheDocument();
    expect(screen.getByTestId('stub-push')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-overview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-members')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-rules')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-insights')).not.toBeInTheDocument();
  });

  it('switches to the Rules tab, rendering Rules and unmounting everything else', async () => {
    const user = userEvent.setup();
    render(<GroupDetailView group={makeGroup()} targetTabId={1} />);

    await user.click(screen.getByRole('tab', { name: 'Rules' }));

    expect(screen.getByRole('tab', { name: 'Rules' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('stub-rules')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-overview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-members')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-access')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-push')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-insights')).not.toBeInTheDocument();
  });

  it('switches to the Insights tab, rendering GroupInsightsPane and unmounting everything else', async () => {
    const user = userEvent.setup();
    render(<GroupDetailView group={makeGroup()} targetTabId={1} />);

    await user.click(screen.getByRole('tab', { name: 'Insights' }));

    expect(screen.getByRole('tab', { name: 'Insights' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('stub-insights')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-overview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-members')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-access')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-push')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stub-rules')).not.toBeInTheDocument();
  });

  it('exposes exactly the five tabs, in order', () => {
    render(<GroupDetailView group={makeGroup()} targetTabId={1} />);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Overview',
      'Members',
      'Access',
      'Rules',
      'Insights',
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

  /*
    The comparison itself belongs to `GroupComparisonModal`, which the Groups list
    already opens from a multi-select and which has its own coverage. What this
    rung adds is the missing half of that modal's input, so what is pinned here is
    the container's own job: the strip's verb opens the picker, and no comparison
    is running behind it until a group has actually been chosen.
  */
  it("wires the action bar's Compare button to the group picker", async () => {
    const user = userEvent.setup();
    render(<GroupDetailView group={makeGroup()} targetTabId={1} />);

    expect(screen.queryByRole('dialog', { name: /Compare with another group/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Compare' }));

    const picker = screen.getByRole('dialog', { name: /Compare with another group/ });
    expect(picker).toBeInTheDocument();
    expect(within(picker).getByRole('button', { name: 'Compare' })).toBeDisabled();
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

  it('auto-analyzes a plain drill-in (autoAnalyze unset) when the group is within the auto-load budget, and still lands on Overview', () => {
    const group = makeGroup(); // memberCount: 10 — well under AUTO_LOAD_MEMBER_CAP
    groupSource.group = { id: group.id };
    render(<GroupDetailView group={group} targetTabId={1} />);
    expect(groupSource.analyzeMembers).toHaveBeenCalledTimes(1);
    // Unlike `autoAnalyze`, the budget-based auto-load doesn't redirect the
    // initial tab — a plain drill-in still opens on Overview either way.
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  });

  it('never auto-analyzes a plain drill-in on a group over the auto-load budget, and lands on Overview', () => {
    const group = makeGroup({ memberCount: 5000 });
    groupSource.group = { id: group.id };
    render(<GroupDetailView group={group} targetTabId={1} />);
    expect(groupSource.analyzeMembers).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  });
});
