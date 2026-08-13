import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import UserComparisonView from './UserComparisonView';
import { mockUsers, mockGroup } from '../../../test/mocks/handlers';
import { classifyAccessCauses } from './comparison/accessCause';
import type { UserComparisonState } from '../../hooks/useUserComparison';
import type { FormattedRule, GroupMembership } from '../../../shared/types';

const contextUser = mockUsers[10];
const comparedUser = mockUsers[11];

/**
 * An obviously-fake rule, used to give a story membership real provenance.
 *
 * Typed as the wider {@link FormattedRule} — the shape `useUserMemberships`
 * actually hands back as its rule inventory — because this one fixture stands in
 * both places a story needs it: the inventory the comparison classifies against,
 * and a membership's own `rules` (a `MembershipRule`, which `FormattedRule`
 * structurally satisfies). One rule in both slots is what makes the story's
 * worklist agree with its group rows.
 */
const vpnRule: FormattedRule = {
  id: '0prFAKErule00001',
  name: 'Contractors → VPN Access',
  status: 'ACTIVE',
  condition: 'user.userType == "Contractor"',
  conditionExpression: 'user.userType == "Contractor"',
  groupIds: ['group456'],
  userAttributes: ['userType'],
  created: '2026-01-01T00:00:00.000Z',
  lastUpdated: '2026-01-01T00:00:00.000Z',
};

/**
 * Buckets carry whole memberships (phase 3.6), so the stories' fixtures are
 * memberships rather than bare groups — including one rule-based membership, so
 * a story exercises a row that has provenance to show.
 */
const membership = (
  id: string,
  name: string,
  over: Partial<GroupMembership> = {},
): GroupMembership => ({
  group: { ...mockGroup, id, profile: { name, description: '' } },
  membershipType: 'DIRECT',
  rules: [],
  attribution: 'exact',
  ...over,
});

const gShared = membership('group123', 'Engineering');
const gOnlyCompared = membership('group456', 'VPN Access', {
  membershipType: 'RULE_BASED',
  rules: [vpnRule],
  attribution: 'exact',
});
const gOnlyContext = membership('group789', 'Design Review');

/**
 * A whole comparison view model, as {@link useUserComparison} would return it.
 * The view is purely presentational, so a story can hand it a literal instead of
 * standing up the hook (which would need the chrome messaging surface and a live
 * Okta tab). Override only the fields a story is about.
 */
const comparison = (over: Partial<UserComparisonState> = {}): UserComparisonState => ({
  comparedUser: null,
  searchQuery: '',
  setSearchQuery: fn(),
  searchResults: [],
  isSearching: false,
  activeTab: 'overview',
  setActiveTab: fn(),
  groupBuckets: { onlyCompared: [], shared: [], onlyContext: [] },
  appBuckets: { onlyCompared: [], shared: [], onlyContext: [] },
  // Nothing loaded yet, so the inventory has not resolved: `undefined` is "not
  // computed", which the worklist renders differently from an empty array.
  causes: undefined,
  groupDiffCount: 0,
  appDiffCount: 0,
  groupSimilarity: 0,
  appSimilarity: 0,
  overallSimilarity: 0,
  isLoading: false,
  loadError: null,
  addingGroupId: null,
  addError: null,
  setAddError: fn(),
  addToContext: fn(),
  addToCompared: fn(),
  contextName: 'First11 Last11',
  // No name for any id: stories exercise the id fallback, not the lookup.
  resolveGroupName: () => undefined,
  comparedName: '',
  selectUser: fn(),
  changeUser: fn(),
  ...over,
});

/** A loaded, two-user comparison with a difference in each direction. */
const loaded = (over: Partial<UserComparisonState> = {}): UserComparisonState =>
  comparison({
    comparedUser,
    comparedName: 'First12 Last12',
    groupBuckets: {
      onlyCompared: [gOnlyCompared],
      shared: [gShared],
      onlyContext: [gOnlyContext],
    },
    // Apps carry Okta's assignment `scope` (phase 4.1) and the Apps tab renders
    // it (4.2). `app4` deliberately has none — Okta did not report one, which the
    // row must show as unknown rather than silently reading as "via group".
    appBuckets: {
      onlyCompared: [
        { id: 'app2', label: 'Salesforce', scope: 'USER' },
        { id: 'app4', label: 'Zoom' },
      ],
      shared: [{ id: 'app1', label: 'Slack', scope: 'USER' }],
      onlyContext: [{ id: 'app3', label: 'Figma', scope: 'GROUP' }],
    },
    // Classified from the very buckets above, exactly as `useUserComparison`
    // memoizes it — so the worklist a story shows is the real classifier's
    // output rather than hand-written copy that could drift from it.
    causes: classifyAccessCauses({
      onlyCompared: [gOnlyCompared],
      contextUser,
      rules: [vpnRule],
    }),
    groupDiffCount: 2,
    appDiffCount: 2,
    groupSimilarity: 33,
    appSimilarity: 33,
    overallSimilarity: 33,
    ...over,
  });

const meta = {
  title: 'Users/UserComparisonView',
  component: UserComparisonView,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The two-user comparison surface itself, independent of how it is shown.\n\n' +
          'Purely presentational: every piece of state (search, load, bucketing, similarity, ' +
          'optimistic group-copy) is owned by `useUserComparison` and handed in whole as the ' +
          '`comparison` prop. The hook is instantiated by the **host**, not here, because both ' +
          'hosts must keep the comparison alive while its surface is hidden — so that the ' +
          "hook's reset effect, not an unmount, is what clears a finished comparison.\n\n" +
          "Two hosts render this: `UserComparisonModal` (the Overview tab's dialog) and " +
          '`UserComparisonPanel` (the Users tab\'s pushed view, ADR-0016). "Change user" is ' +
          'rendered here rather than by a host, because the dialog has a footer and the pushed ' +
          'view does not.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Types](?path=/docs/internals-types--docs)',
      },
    },
  },
  args: {
    contextUser,
    comparison: comparison(),
  },
  argTypes: {
    contextUser: {
      description: 'The "context" user being compared from (the user currently in focus).',
    },
    comparison: {
      description: "The whole comparison view model, from the host's `useUserComparison` instance.",
    },
  },
} satisfies Meta<typeof UserComparisonView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Phase 1 — no compared user picked yet, so the search phase is shown. */
export const SearchPhase: Story = {};

/** Phase 1 with a committed query in flight. */
export const Searching: Story = {
  args: { comparison: comparison({ searchQuery: 'last12', isSearching: true }) },
};

/** Phase 1 with results to choose from. */
export const SearchResults: Story = {
  args: {
    comparison: comparison({ searchQuery: 'last12', searchResults: [comparedUser] }),
  },
};

/** Phase 2 — the overview tab of a loaded comparison. */
export const OverviewTab: Story = {
  args: { comparison: loaded() },
};

/** Phase 2, Groups tab: the copyable diff in both directions. */
export const GroupsTab: Story = {
  args: { comparison: loaded({ activeTab: 'groups' }) },
};

/**
 * Phase 2, Apps tab: the same diff shape with no copy affordance, plus each row's
 * assignment source.
 *
 * `Direct` means Okta reports a direct assignment — **not** that no group also
 * grants the app; Okta returns one scope per app-user. A row Okta reported no
 * scope for says "Source unknown", and a shared row says "Source not compared",
 * because the buckets carry only the compared user's scope for it.
 */
export const AppsTab: Story = {
  args: { comparison: loaded({ activeTab: 'apps' }) },
};

/** The hero and tab bar stay mounted while the two loads settle; only the body is gated. */
export const Loading: Story = {
  args: { comparison: loaded({ isLoading: true }) },
};

/** A failed membership load replaces the tab body with a `danger` alert; the hero survives. */
export const LoadError: Story = {
  args: { comparison: loaded({ loadError: 'Failed to load memberships' }) },
};

/** A failed group copy surfaces a dismissible `danger` alert above the diff. */
export const AddError: Story = {
  args: {
    comparison: loaded({ activeTab: 'groups', addError: 'Insufficient permissions' }),
  },
};

/**
 * A copy in flight. The lock is deliberately **global**, not per-row: every Add
 * button disables while one request is outstanding.
 */
export const CopyInFlight: Story = {
  args: {
    comparison: loaded({ activeTab: 'groups', addingGroupId: gOnlyCompared.group.id }),
  },
};
