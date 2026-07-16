import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupSelectionBar from './GroupSelectionBar';

/**
 * The "N of M selected" bar and its action buttons above the groups list; button
 * visibility is gated by the current selection size.
 */
const meta = {
  title: 'Groups/GroupSelectionBar',
  component: GroupSelectionBar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    selectedCount: 0,
    filteredCount: 42,
    activePanel: 'none',
    crossSearchBadge: 0,
    onSelectAll: fn(),
    onDeselectAll: fn(),
    onCompare: fn(),
    onMerge: fn(),
    onTogglePanel: fn(),
    onExportSelection: fn(),
    onExportGroupsList: fn(),
  },
} satisfies Meta<typeof GroupSelectionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing selected — only Select All / Deselect All / Export List are shown. */
export const Default: Story = {};

/** Two groups selected — Compare, Merge, Bulk Actions, and Export appear. */
export const WithSelection: Story = {
  args: { selectedCount: 2 },
};

/** More than 5 selected — Compare is hidden (only supports 2–5), Merge remains. */
export const LargeSelection: Story = {
  args: { selectedCount: 12 },
};

/** The Cross-Search badge shows the number of cached cross-group search results. */
export const WithCrossSearchBadge: Story = {
  args: { selectedCount: 3, crossSearchBadge: 5 },
};

/** Bulk Actions panel is open, highlighting its trigger button. */
export const BulkPanelOpen: Story = {
  args: { selectedCount: 4, activePanel: 'bulk' },
};

/** No groups match the current filters — Export List becomes disabled. */
export const NoFilteredGroups: Story = {
  args: { filteredCount: 0 },
};
