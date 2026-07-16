import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import RulesToolbar from './RulesToolbar';

/** Search + filter + sort controls for the Rules tab. */
const meta = {
  title: 'Rules/RulesToolbar',
  component: RulesToolbar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    searchQuery: '',
    onSearchChange: fn(),
    activeFilter: 'all',
    onFilterChange: fn(),
    conflictsCount: 0,
    showCurrentGroup: false,
    sortMode: 'default',
    onSortChange: fn(),
  },
} satisfies Meta<typeof RulesToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default: no filter active, no conflicts, no current-group chip. */
export const Default: Story = {};

/** A search term has been typed. */
export const WithSearchQuery: Story = {
  args: { searchQuery: 'Engineering' },
};

/** "Active Only" filter selected. */
export const ActiveFilterSelected: Story = {
  args: { activeFilter: 'active' },
};

/** Conflicts detected — the Conflicts chip is enabled and shows a count. */
export const WithConflicts: Story = {
  args: { conflictsCount: 5 },
};

/** Conflicts filter selected with conflicts present. */
export const ConflictsFilterSelected: Story = {
  args: { activeFilter: 'conflicts', conflictsCount: 5 },
};

/** A group is detected in context — the "Current Group" chip is shown. */
export const WithCurrentGroupChip: Story = {
  args: { showCurrentGroup: true, activeFilter: 'current-group' },
};

/** Sorted by similarity instead of the default order. */
export const SortedBySimilarity: Story = {
  args: { sortMode: 'similarity' },
};
