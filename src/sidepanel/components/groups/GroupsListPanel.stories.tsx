import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupsListPanel from './GroupsListPanel';
import { mockGroup } from '../../../test/mocks/fixtures';
import type { GroupSummary } from '../../../shared/types';

const sampleGroups: GroupSummary[] = [
  {
    id: mockGroup.id,
    name: mockGroup.profile.name,
    description: mockGroup.profile.description,
    type: 'OKTA_GROUP',
    memberCount: 128,
    hasRules: true,
    ruleCount: 2,
  },
  {
    id: 'group456',
    name: 'Push - Salesforce Admins',
    type: 'APP_GROUP',
    memberCount: 14,
    hasRules: false,
    ruleCount: 0,
    sourceAppId: 'app1',
    sourceAppName: 'Salesforce',
  },
  {
    id: 'group789',
    name: 'Everyone',
    type: 'BUILT_IN',
    memberCount: 5400,
    hasRules: false,
    ruleCount: 0,
  },
];

/** The scrollable groups list plus its mode-specific empty states. */
const meta = {
  title: 'Groups/GroupsListPanel',
  component: GroupsListPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The scrollable groups list plus its mode-specific empty states.\n\n' +
          'Renders a `GroupListItem` per filtered group, forwarding selection, deep-link, ' +
          'and analyze-source handlers. Shows a spinner during the initial load, and ' +
          'distinct empty states for cached mode with excluding filters versus a live ' +
          'search that returned no matches — the live "no results" copy is suppressed ' +
          'while a search is still in flight.',
      },
    },
  },
  argTypes: {
    loading: { description: 'Whether the initial group load is in progress.' },
    searchMode: { description: '`live` queries Okta directly; `cached` filters the loaded list.' },
    liveSearchQuery: {
      description: 'Current live-search query (drives the live empty-state copy).',
    },
    isLiveSearching: {
      description: 'Whether a live search is in flight (suppresses the "no results" state).',
    },
    hasGroups: {
      description: 'Whether any groups are loaded — gates the cached-mode empty state.',
    },
    activeFilterCount: {
      description: 'Active-filter count — gates the "Clear Filters" empty-state action.',
    },
    filteredGroups: { description: 'Groups to render after filtering/sorting.' },
    selectedGroupIds: { description: 'Ids of the currently selected groups.' },
    onToggleSelect: { description: 'Toggles selection for a group id.' },
    oktaOrigin: { description: 'Okta origin passed to each row for deep-linking.' },
    onLoadAllGroups: {
      description: 'Switches to cached mode by loading all groups (live empty-state action).',
    },
    onClearFilters: { description: 'Clears all filters (cached empty-state action).' },
    onOpenDetail: {
      description:
        "Drills into a group's read-only detail view (pushes onto the tab's view stack).",
    },
    highlightedGroupId: {
      description: 'Group id to highlight (deep-link target from the Rules tab).',
    },
  },
  args: {
    loading: false,
    searchMode: 'cached',
    liveSearchQuery: '',
    isLiveSearching: false,
    hasGroups: true,
    activeFilterCount: 0,
    filteredGroups: sampleGroups,
    selectedGroupIds: new Set<string>(),
    onToggleSelect: fn(),
    oktaOrigin: 'https://example.okta.com',
    onLoadAllGroups: fn(),
    onClearFilters: fn(),
    onOpenDetail: fn(),
  },
} satisfies Meta<typeof GroupsListPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three groups spanning the OKTA/APP/BUILT-IN types. */
export const Default: Story = {};

/** One group is selected. */
export const WithSelection: Story = {
  args: { selectedGroupIds: new Set([sampleGroups[0].id]) },
};

/** One group is highlighted (deep-link target from the Rules tab). */
export const Highlighted: Story = {
  args: { highlightedGroupId: sampleGroups[1].id },
};

/** Initial group load in progress. */
export const Loading: Story = {
  args: { loading: true, filteredGroups: [] },
};

/** Cached mode with active filters that exclude every group. */
export const EmptyWithFilters: Story = {
  args: { filteredGroups: [], hasGroups: true, activeFilterCount: 2 },
};

/** Live mode with a query that returned no matches. */
export const LiveNoResults: Story = {
  args: {
    filteredGroups: [],
    searchMode: 'live',
    liveSearchQuery: 'nonexistent-group',
    isLiveSearching: false,
    hasGroups: false,
  },
};

/** Live mode, a search is currently in flight (suppresses the empty state). */
export const LiveSearching: Story = {
  args: {
    filteredGroups: [],
    searchMode: 'live',
    liveSearchQuery: 'admins',
    isLiveSearching: true,
    hasGroups: false,
  },
};

/**
 * A large filtered list (120 groups): only the first 50 rows are mounted, with a
 * "Showing X of Y" footer plus a Load more button / scroll sentinel to reveal the
 * rest incrementally.
 */
export const LargeListWindowed: Story = {
  args: {
    filteredGroups: Array.from({ length: 120 }, (_, i) => ({
      id: `00gFAKE${String(i).padStart(4, '0')}`,
      name: `Team ${i + 1}`,
      description: 'Generated sample group',
      type: 'OKTA_GROUP' as const,
      memberCount: (i * 7) % 400,
      hasRules: i % 5 === 0,
      ruleCount: i % 5 === 0 ? 1 : 0,
    })),
  },
};
