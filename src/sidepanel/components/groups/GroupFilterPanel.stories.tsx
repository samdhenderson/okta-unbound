import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupFilterPanel from './GroupFilterPanel';

const availablePushApps = [
  { id: 'app1', name: 'Salesforce' },
  { id: 'app2', name: 'Workday' },
  { id: 'app3', name: 'Zoom' },
];

/** Expandable cached-mode filter + sort panel for the groups list. */
const meta = {
  title: 'Groups/GroupFilterPanel',
  component: GroupFilterPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Expandable cached-mode filter + sort panel for the groups list.\n\n' +
          'Filters by group type, member-count bucket, push status, push-target app, and ' +
          'health/staleness, and sorts by a chosen field/direction. When any filters are ' +
          'active it surfaces a summary chips row with a "Clear all" link; the ' +
          'push-target-app row is hidden when no push apps are available.',
      },
    },
  },
  argTypes: {
    activeFilterCount: { description: 'Number of active filters (drives the active-chips row).' },
    typeFilter: { description: "Selected group-type filter (`''` = all)." },
    setTypeFilter: { description: 'Sets the group-type filter.' },
    sizeFilter: { description: "Selected member-count bucket (`''` = all)." },
    setSizeFilter: { description: 'Sets the member-count bucket.' },
    pushFilter: { description: 'Push-status filter.' },
    setPushFilter: { description: 'Sets the push-status filter.' },
    pushAppFilter: { description: 'Set of push-target app ids to filter by (empty = all).' },
    setPushAppFilter: { description: 'Updates the push-target-app id set.' },
    stalenessFilter: { description: "Selected health/staleness bucket (`''` = all)." },
    setStalenessFilter: { description: 'Sets the health/staleness bucket.' },
    availablePushApps: { description: 'Push-target apps available as filter chips.' },
    sortBy: { description: 'Active sort field.' },
    sortDesc: { description: 'Whether the active sort is descending.' },
    toggleSort: { description: 'Toggles the sort field (or flips direction if already active).' },
    clearFilters: { description: 'Resets all filters (and the search query).' },
  },
  args: {
    activeFilterCount: 0,
    typeFilter: '',
    setTypeFilter: fn(),
    sizeFilter: '',
    setSizeFilter: fn(),
    pushFilter: '',
    setPushFilter: fn(),
    pushAppFilter: new Set<string>(),
    setPushAppFilter: fn(),
    stalenessFilter: '',
    setStalenessFilter: fn(),
    availablePushApps,
    sortBy: 'name',
    sortDesc: false,
    toggleSort: fn(),
    clearFilters: fn(),
  },
} satisfies Meta<typeof GroupFilterPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No filters active — the chips row is hidden. */
export const Default: Story = {};

/** Several filters active — shows the active-filter chips row with a "Clear all" link. */
export const WithActiveFilters: Story = {
  args: {
    activeFilterCount: 3,
    typeFilter: 'OKTA_GROUP',
    sizeFilter: 'large',
    pushFilter: 'pushed',
    stalenessFilter: 'stale',
  },
};

/** Push-target app filter chip active, driving the "Apps:" summary chip. */
export const WithPushAppFilter: Story = {
  args: {
    activeFilterCount: 1,
    pushAppFilter: new Set(['app1', 'app2']),
  },
};

/** No push-target apps available — the "Push Target App" row is hidden. */
export const NoPushApps: Story = {
  args: { availablePushApps: [] },
};

/** Sorted by member count, descending. */
export const SortedDescending: Story = {
  args: { sortBy: 'memberCount', sortDesc: true },
};
