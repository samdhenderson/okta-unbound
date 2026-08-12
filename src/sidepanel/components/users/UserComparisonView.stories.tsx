import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import UserComparisonView from './UserComparisonView';
import { mockUsers, mockGroup } from '../../../test/mocks/handlers';
import type { UserComparisonState } from '../../hooks/useUserComparison';
import type { OktaGroup } from '../../../shared/types';

const contextUser = mockUsers[10];
const comparedUser = mockUsers[11];

const group = (id: string, name: string): OktaGroup => ({
  ...mockGroup,
  id,
  profile: { name, description: '' },
});

const gShared = group('group123', 'Engineering');
const gOnlyCompared = group('group456', 'VPN Access');
const gOnlyContext = group('group789', 'Design Review');

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
    appBuckets: {
      onlyCompared: [{ id: 'app2', label: 'Salesforce' }],
      shared: [{ id: 'app1', label: 'Slack' }],
      onlyContext: [{ id: 'app3', label: 'Figma' }],
    },
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

/** Phase 2, Apps tab: the same diff shape with no copy affordance. */
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
    comparison: loaded({ activeTab: 'groups', addingGroupId: gOnlyCompared.id }),
  },
};
