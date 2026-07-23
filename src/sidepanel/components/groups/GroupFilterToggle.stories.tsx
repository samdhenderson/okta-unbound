import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupFilterToggle from './GroupFilterToggle';

/** The "Filters" toggle button with its active-filter count badge, shown beside the search bar in cached mode. */
const meta = {
  title: 'Groups/GroupFilterToggle',
  component: GroupFilterToggle,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The "Filters" toggle button shown beside the search bar in cached mode.\n\n' +
          'Opens and closes the filter panel and carries a count badge of the currently ' +
          'active filters. Takes on active styling both when the panel is expanded and ' +
          'when any filters are applied.',
      },
    },
  },
  argTypes: {
    showFilters: {
      description: 'Whether the filter panel is currently expanded (drives the active styling).',
    },
    activeFilterCount: { description: 'Active-filter count shown in the badge (hidden at 0).' },
    onToggle: { description: 'Toggles the filter panel open/closed.' },
  },
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
