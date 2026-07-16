import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupsListPanel from './GroupsListPanel';
import { mockGroup } from '../../../test/mocks/handlers';
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
    lastMembershipUpdated: new Date('2026-06-01'),
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
    staleness: { score: 62, factors: ['No membership change in 180 days'] },
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
  parameters: { layout: 'fullscreen' },
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
    onAnalyzeSource: fn(),
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
