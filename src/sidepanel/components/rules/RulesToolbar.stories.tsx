import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import RulesToolbar from './RulesToolbar';

/** Search + filter + sort controls for the Rules tab. */
const meta = {
  title: 'Rules/RulesToolbar',
  component: RulesToolbar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Search, filter, and sort controls for the Rules tab.\n\n' +
          'A free-text search field over rule name/condition/attributes sits above a row of filter chips (All / Active Only / Conflicts / Current Group) and a sort selector. The Conflicts chip is disabled until conflicts exist and shows their count; the Current Group chip appears only when a group is detected on the page. Chips route through the shared `FilterPill`; the search field is a documented raw-`<input>` composite (leading glyph) matching the group/user search bars.',
      },
    },
  },
  argTypes: {
    searchQuery: { description: 'Current search text.' },
    onSearchChange: { description: 'Called with the new query as the user types.' },
    activeFilter: { description: 'Active filter chip.' },
    onFilterChange: { description: 'Called with the newly selected filter chip.' },
    conflictsCount: { description: 'Conflict count shown on (and gating) the Conflicts chip.' },
    showCurrentGroup: {
      description: 'Whether to show the "Current Group" chip (a group is detected).',
    },
    sortMode: { description: 'Active list sort mode.' },
    onSortChange: { description: 'Change the list sort mode.' },
  },
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
