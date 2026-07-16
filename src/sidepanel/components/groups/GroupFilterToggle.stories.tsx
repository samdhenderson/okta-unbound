import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupFilterToggle from './GroupFilterToggle';

/** The "Filters" toggle button with its active-filter count badge, shown beside the search bar in cached mode. */
const meta = {
  title: 'Groups/GroupFilterToggle',
  component: GroupFilterToggle,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    showFilters: false,
    activeFilterCount: 0,
    onToggle: fn(),
  },
} satisfies Meta<typeof GroupFilterToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Collapsed, no active filters. */
export const Default: Story = {};

/** Panel expanded — active styling even with zero filters. */
export const Expanded: Story = {
  args: { showFilters: true },
};

/** Collapsed with active filters — shows the count badge and active styling. */
export const WithActiveFilters: Story = {
  args: { activeFilterCount: 4 },
};

/** Expanded with active filters. */
export const ExpandedWithActiveFilters: Story = {
  args: { showFilters: true, activeFilterCount: 2 },
};
