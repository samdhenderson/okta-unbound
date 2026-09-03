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
 * hooks of its own, and "Export omitted/present, Add wired, Create feeding rule
 * behind **More**" is exactly the kind of user-visible behavior a mock would
 * hide.
 *
 * The seven loading/mutating hooks (`useGroupSource`, `useGroupRuleReferences`,
 * `useGroupAccessGrants`, `useMemberMfaScan`, `useGroupMembersSection`,
 * `useAddGroupMember`, `useCreateFeedingRule`) are mocked at the hook boundary — the established
 * pattern for a container test, e.g. `UserComparisonPanel.scroll.test.tsx`'s
 * `useUserComparison` mock. The one exception is `useOwedLoad`, left real,
 * because the `initialPane` coverage below is exactly about the gating it
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

const createFeedingRule = vi.hoisted(() => ({
  isOpen: false,
  open: vi.fn(),
  close: vi.fn(),
  name: '',
  setName: vi.fn(),
  nameError: null as string | null,
  expression: '',
  setExpression: vi.fn(),
  expressionNotice: null as string | null,
  canSubmit: false,
  isCreating: false,
  error: null as string | null,
  createdRuleName: null as string | null,
  createdRuleId: null as string | null,
  confirm: vi.fn(),
}));

vi.mock('../../../hooks/useCreateFeedingRule', () => ({
  useCreateFeedingRule: () => createFeedingRule,
}));

// ---------------------------------------------------------------------------
// Section test doubles — each renders one identifiable node so a tab switch
// reads as "which stub is mounted", not a rendered section's own internals.
// ---------------------------------------------------------------------------
vi.mock('./GroupOverviewPane', () => ({
  default: () => <div data-testid="stub-overview" />,
}));
/*
  These two stubs take part in the Insights → Members jump rather than ignoring
  it, because the jump is the one thing this rung does that neither pane can do
  alone: Insights raises a request, this view routes it, Members receives it.

  Note what is asserted downstream: not "GroupDetailView passed a prop to a mock"
  — ADR-0023 bans that, and it would pass even if the panes never switched — but
  that pressing a control in one pane lands the reader in the other with the
  filter in hand. The stubs behave like the real components at that seam so the
  routing is what is under test.
*/
vi.mock('./GroupMembersSection', () => ({
  default: ({ pendingFilter }: { pendingFilter?: { label: string } | null }) => (
    <div data-testid="stub-members">
      {pendingFilter ? `filtered by ${pendingFilter.label}` : ''}
    </div>
  ),
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
  default: ({
    onFilterMembers,
  }: {
    onFilterMembers?: (f: { dimension: string; value: string; label: string }) => void;
  }) => (
    <div data-testid="stub-insights">
      <button
        type="button"
        onClick={() =>
          onFilterMembers?.({ dimension: 'department', value: '', label: 'department is blank' })
        }
      >
        Filter Members
      </button>
    </div>
  ),
}));
vi.mock('./AddGroupMemberModal', () => ({
  default: () => <div data-testid="stub-add-modal" />,
}));
vi.mock('./CreateFeedingRuleModal', () => ({
  default: () => <div data-testid="stub-create-rule-modal" />,
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
  it('carries an Insights row click to the Members pane with its filter applied', async () => {
    const user = userEvent.setup();
    render(<GroupDetailView group={makeGroup()} targetTabId={1} />);

    await user.click(screen.getByRole('tab', { name: 'Insights' }));
    await user.click(screen.getByRole('button', { name: 'Filter Members' }));

    // Both halves matter. Landing on Members without the filter would strand the
    // reader on an unfiltered roster having asked a specific question; applying
    // the filter without switching panes would apply it somewhere they cannot
    // see. Neither half is a valid outcome on its own.
    expect(screen.getByRole('tab', { name: 'Members' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('stub-members')).toHaveTextContent('filtered by department is blank');
    expect(screen.queryByTestId('stub-insights')).not.toBeInTheDocument();
  });

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

  /*
    ADR-0068 §2: an export descriptor never sits in the row, on any rung. It does
    not produce a file in place — it forwards to the Export tab with its column
    picker and presets — so it is navigation wearing a verb's clothes. Asserted
    through the region the **More** control names, the same way *Create feeding
    rule* is above: jsdom honours neither `inert` nor CSS, so "is it visible"
    would pass either way.
  */
  it('keeps Export members in the disclosure tier, not the action row', () => {
    render(<GroupDetailView group={makeGroup()} targetTabId={1} onExportGroup={vi.fn()} />);

    const more = screen.getByRole('button', { name: /More/ });
    const tierId = more.getAttribute('aria-controls');
    const tier = tierId ? document.getElementById(tierId) : null;
    if (!tier) throw new Error('the More control names no region');

    expect(within(tier).getByRole('button', { name: /export members/i })).toBeInTheDocument();
    // And `Add`, the verb that acts, is in the row rather than the tier.
    expect(within(tier).queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it("wires the action bar's Add button to the Add-member modal", async () => {
    const user = userEvent.setup();
    render(<GroupDetailView group={makeGroup()} targetTabId={1} />);

    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(addMember.openModal).toHaveBeenCalledTimes(1);
  });

  /*
    ADR-0039 §2: *Create feeding rule* is the rung's one verb with no symmetric
    undo — a rule grants memberships as it matches and deleting it leaves them in
    place — so it starts in the strip's disclosure tier rather than in the row.
    Asserted structurally, through the region the **More** control names: jsdom
    honours neither `inert` nor CSS, so "is it visible" would pass either way.
  */
  it('keeps Create feeding rule in the disclosure tier, not the action row', () => {
    render(<GroupDetailView group={makeGroup()} targetTabId={1} />);

    const more = screen.getByRole('button', { name: /More/ });
    expect(more).toHaveAttribute('aria-expanded', 'false');

    const tierId = more.getAttribute('aria-controls');
    const tier = tierId ? document.getElementById(tierId) : null;
    if (!tier) throw new Error('the More control names no region');

    expect(within(tier).getByRole('button', { name: 'Create feeding rule' })).toBeInTheDocument();
    // The consequence is stated beside the control, not only inside the dialog.
    expect(
      within(tier).getByText(/Memberships a rule grants outlive the rule/),
    ).toBeInTheDocument();
  });

  it("wires the tier's Create feeding rule to the confirm dialog", async () => {
    const user = userEvent.setup();
    render(<GroupDetailView group={makeGroup()} targetTabId={1} />);

    await user.click(screen.getByRole('button', { name: 'Create feeding rule' }));
    expect(createFeedingRule.open).toHaveBeenCalledTimes(1);
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

  it("fires the gated member-source analysis exactly once when initialPane is 'members' and the open has landed", () => {
    const group = makeGroup();
    groupSource.group = { id: group.id };

    const { rerender } = render(
      <GroupDetailView group={group} targetTabId={1} initialPane="members" isActive />,
    );
    expect(groupSource.analyzeMembers).toHaveBeenCalledTimes(1);

    // A re-render with the same group identity — including a visibility
    // round trip — must not re-fire the once-per-group latch.
    rerender(
      <GroupDetailView group={group} targetTabId={1} initialPane="members" isActive={false} />,
    );
    rerender(<GroupDetailView group={group} targetTabId={1} initialPane="members" isActive />);
    expect(groupSource.analyzeMembers).toHaveBeenCalledTimes(1);

    // It lands where the result is visible: `initialPane` picks Members as the
    // initial tab instead of the plain-drill-in default of Overview (see that
    // prop's doc on `GroupDetailView`).
    expect(screen.getByRole('tab', { name: 'Members' })).toHaveAttribute('aria-selected', 'true');
  });

  it('auto-analyzes a plain drill-in (initialPane unset) when the group is within the auto-load budget, and still lands on Overview', () => {
    const group = makeGroup(); // memberCount: 10 — well under AUTO_LOAD_MEMBER_CAP
    groupSource.group = { id: group.id };
    render(<GroupDetailView group={group} targetTabId={1} />);
    expect(groupSource.analyzeMembers).toHaveBeenCalledTimes(1);
    // Unlike `initialPane`, the budget-based auto-load doesn't redirect the
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
