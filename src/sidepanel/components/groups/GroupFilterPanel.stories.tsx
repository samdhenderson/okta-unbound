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
  parameters: { layout: 'fullscreen' },
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
