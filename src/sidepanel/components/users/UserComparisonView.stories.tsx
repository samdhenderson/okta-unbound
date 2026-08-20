import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import UserComparisonView from './UserComparisonView';
import { mockUsers, mockGroup } from '../../../test/mocks/fixtures';
import { classifyAccessCauses } from './comparison/accessCause';
import type { UserComparisonState } from '../../hooks/useUserComparison';
import type { AttributeParityRow, AttributeVerdict } from './comparison/attributeParity';
import type { FormattedRule, GroupMembership } from '../../../shared/types';
import type { ProfileDisplayConfig } from '../../../shared/storage/profileDisplayStore';
import { DEFAULT_PROFILE_DISPLAY_CONFIG } from '../../../shared/storage/profileDisplayStore';

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
 * One attribute parity row, as `attributeParityRows` would emit it.
 *
 * Hand-written rather than derived from two fixture users, so a single story can
 * put all five verdicts on screen at once — which is the only view where the
 * value cells, the `— not set` non-answer and the marker column can be judged
 * against each other.
 */
const attrRow = (
  name: string,
  label: string,
  contextValue: string,
  comparedValue: string,
  verdict: AttributeVerdict,
  over: Partial<AttributeParityRow> = {},
): AttributeParityRow => ({
  key: `profile.${name}`,
  name,
  label,
  kind: 'base',
  contextValue,
  comparedValue,
  verdict,
  categoryKey: 'organization',
  hiddenByConfig: false,
  ...over,
});

/**
 * All five verdicts, deliberately in the order the pure module emits: the three
 * differences first, then the two agreements.
 */
const ATTRIBUTE_ROWS: AttributeParityRow[] = [
  attrRow('department', 'Department', 'Engineering', 'Design', 'differs'),
  attrRow('manager', 'Manager', 'dana@example.com', '', 'onlyContext'),
  attrRow('costCenter', 'Cost center', '', 'CC-42', 'onlyCompared'),
  attrRow('userType', 'User type', 'Employee', 'Employee', 'same', {
    categoryKey: 'identity',
  }),
  attrRow('nickName', 'Nickname', '', '', 'bothEmpty', { categoryKey: '' }),
];

/** An attribute the admin's config hides — and the two users disagree on it. */
const HIDDEN_ATTRIBUTE_ROWS: AttributeParityRow[] = [
  attrRow('employeeNumber', 'Employee number', 'E-0001', 'E-0002', 'differs', {
    hiddenByConfig: true,
  }),
];

/**
 * A display configuration with a real category order and one category nothing is
 * filed under — `Contact & locale` must simply not appear, rather than rendering
 * as an empty heading.
 */
const ATTRIBUTE_CONFIG: ProfileDisplayConfig = {
  ...DEFAULT_PROFILE_DISPLAY_CONFIG,
  categories: [
    { key: 'identity', name: 'Identity' },
    { key: 'organization', name: 'Organization' },
    { key: 'contact-locale', name: 'Contact & locale' },
  ],
  assign: {
    userType: 'identity',
    department: 'organization',
    manager: 'organization',
    costCenter: 'organization',
    employeeNumber: 'organization',
    nickName: '',
  },
  attrOrder: ['userType', 'department', 'manager', 'costCenter', 'employeeNumber', 'nickName'],
  hidden: { employeeNumber: true },
};

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
  // The Attributes dimension, empty until a second user is picked — the same
  // frozen shape `useUserComparison` hands back during the search phase.
  attributeParity: { rows: [], hiddenRows: [], hiddenDifferences: 0, differenceCount: 0 },
  attributeDiffCount: 0,
  attributeConfig: DEFAULT_PROFILE_DISPLAY_CONFIG,
  attributeRuleReads: {},
  groupSimilarity: 0,
  appSimilarity: 0,
  overallSimilarity: 0,
  similarityScope: 'both',
  appsIncomplete: false,
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

/**
 * A failed app read is **advisory, not blocking**: the group half loaded, so the
 * tabs stay and a `warning` alert caveats them. The app card reports "overlap
 * unavailable" rather than 0%, and the hero's headline says it covers groups only
 * — because averaging in an app score of zero would silently halve it.
 */
export const AppsIncomplete: Story = {
  args: {
    comparison: loaded({
      appsIncomplete: true,
      appSimilarity: null,
      similarityScope: 'groups-only',
      // The group figure alone, not the blended 33% the other stories show.
      overallSimilarity: 33,
    }),
  },
};

/** The same failure seen from the Apps tab, where the diff itself is the caveated thing. */
export const AppsIncompleteOnAppsTab: Story = {
  args: {
    comparison: loaded({
      activeTab: 'apps',
      appsIncomplete: true,
      appSimilarity: null,
      similarityScope: 'groups-only',
      overallSimilarity: 33,
      // Nothing arrived at all — the case where the old empty text would have
      // claimed "Neither user is assigned any apps."
      appBuckets: { onlyCompared: [], shared: [], onlyContext: [] },
      appDiffCount: 0,
    }),
  },
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

/**
 * A loaded comparison sitting on the Attributes tab, with the display config that
 * groups the rows and hides one of them.
 */
const withAttributes = (over: Partial<UserComparisonState> = {}): UserComparisonState =>
  loaded({
    activeTab: 'attributes',
    attributeParity: {
      rows: ATTRIBUTE_ROWS,
      hiddenRows: HIDDEN_ATTRIBUTE_ROWS,
      hiddenDifferences: 1,
      differenceCount: 3,
    },
    attributeDiffCount: 3,
    attributeConfig: ATTRIBUTE_CONFIG,
    // One attribute is read by a rule that currently grants access — the chip
    // that turns a list of strings into an explanation of someone's access.
    attributeRuleReads: { department: ['Engineering → VPN Access'] },
    ...over,
  });

/**
 * Phase 2, Attributes tab: what is *different about these two people*.
 *
 * All five verdicts are on screen at once — `differs`, `onlyContext`,
 * `onlyCompared`, `same` and `bothEmpty` — which is the only view where the two
 * value cells, the `— not set` non-answer and the marker column can be judged
 * against each other. The list opens on the differences, so the play function
 * switches it to **All**.
 *
 * `Department` carries a `1 rule` chip: a currently-granting rule reads it, which
 * is what makes an attribute diff an access explanation rather than trivia.
 * `Contact & locale` is configured but empty, and correctly does not appear.
 */
export const AttributesTab: Story = {
  args: { comparison: withAttributes() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^All/ }));
    await waitFor(() => expect(canvas.getByText('User type')).toBeInTheDocument());
    // The two agreements and one of the non-answers.
    expect(canvas.getByText('Nickname')).toBeInTheDocument();
    expect(canvas.getAllByText('— not set').length).toBeGreaterThan(0);
    // A configured category nothing landed in is dropped, not rendered empty.
    expect(canvas.queryByText('Contact & locale')).not.toBeInTheDocument();
  },
};

/**
 * The honesty requirement: an attribute the display config hides, which the two
 * users actually **differ** on, is counted and disclosed rather than dropped — a
 * compare that silently omitted the one difference explaining an access gap would
 * be worse than no compare at all.
 *
 * The play function reveals it and checks the row arrives marked as hidden.
 */
export const AttributesHiddenDifferences: Story = {
  args: { comparison: withAttributes() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(
      canvas.getByText('1 differing attribute hidden by your display config'),
    ).toBeInTheDocument();
    expect(canvas.queryByText('Employee number')).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Show' }));
    await waitFor(() => expect(canvas.getByText('Employee number')).toBeInTheDocument());
    expect(canvas.getByText('Hidden')).toBeInTheDocument();
  },
};

/** `showApiNames` renders the Okta name in mono instead of the human label. */
export const AttributesApiNames: Story = {
  args: {
    comparison: withAttributes({
      attributeConfig: { ...ATTRIBUTE_CONFIG, showApiNames: true },
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText('department')).toBeInTheDocument());
    expect(canvas.queryByText('Department')).not.toBeInTheDocument();
  },
};

/** Filtered to nothing — distinct from "there are no attributes to compare". */
export const AttributesFilteredToNothing: Story = {
  args: { comparison: withAttributes() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Filter attributes by name or value'), 'zzzz');
    await waitFor(() => expect(canvas.getByText('No attributes match')).toBeInTheDocument());
  },
};

/**
 * The compact side panel. Two value cells plus a marker at 360px is exactly where
 * this layout breaks: the values wrap rather than truncate (two values differing
 * only in their tails must not be able to render identically), and the tab bar
 * takes a second row rather than clipping "Attributes".
 */
export const AttributesCompactPanel: Story = {
  args: { comparison: withAttributes() },
  parameters: { viewport: { value: 'sidepanelCompact' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^All/ }));
    await waitFor(() => expect(canvas.getByText('User type')).toBeInTheDocument());
  },
};
