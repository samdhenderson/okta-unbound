import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import AppsToolbar from './AppsToolbar';

/** Search, status and group-push filters, and sort controls for the Applications list. */
const meta = {
  title: 'Apps/AppsToolbar',
  component: AppsToolbar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Search, status and group-push filters, and sort controls for the Applications list.\n\n' +
          'Fully controlled: the tab shell owns the filter state, so the same values drive ' +
          'both this row and the filtered list. The search box accepts a `/pattern/flags` ' +
          'regex query (parsed by the shared `regexQuery` helper) as well as plain substrings.\n\n' +
          '**"Pushes nothing" is narrower than it sounds, deliberately.** It means Group Push is ' +
          'enabled on the app and the org snapshot holds no group assignment for it. The snapshot ' +
          'walks `/api/v1/apps/{id}/groups` only for `GROUP_PUSH` apps, so for anything else an ' +
          'absent assignment means *nobody asked* — a wider bucket would report the whole ' +
          'inventory as unassigned.',
      },
    },
  },
  argTypes: {
    searchQuery: { description: 'Current search text (`/pattern/flags` is treated as a regex).' },
    onSearchQueryChange: { description: 'Called with the new search text.' },
    statusFilter: { description: "Selected status bucket (`''` = all)." },
    onStatusFilterChange: { description: 'Called with the newly selected status bucket.' },
    groupsFilter: { description: "Selected group-push bucket (`''` = all)." },
    onGroupsFilterChange: { description: 'Called with the newly selected group-push bucket.' },
    sortBy: { description: 'The active sort field.' },
    sortDesc: { description: 'Whether the active sort is descending.' },
    onToggleSort: {
      description: 'Select a sort field, or flip the direction when it is already active.',
    },
    resultCount: { description: 'Number of apps after filtering.' },
    totalCount: { description: 'Number of apps loaded in total.' },
  },
  args: {
    searchQuery: '',
    onSearchQueryChange: fn(),
    statusFilter: '',
    onStatusFilterChange: fn(),
    groupsFilter: '',
    onGroupsFilterChange: fn(),
    sortBy: 'label',
    sortDesc: false,
    onToggleSort: fn(),
    resultCount: 42,
    totalCount: 42,
  },
} satisfies Meta<typeof AppsToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No search, no status bucket, sorted by name ascending. */
export const Default: Story = {};

/** A plain substring search narrowing the result count. */
export const Searching: Story = {
  args: { searchQuery: 'sales', resultCount: 3 },
};

/** A `/regex/` query — matched as a real RegExp, never evaluated. */
export const RegexQuery: Story = {
  args: { searchQuery: '/^okta_/i', resultCount: 7 },
};

/** The inactive bucket selected. */
export const InactiveFilter: Story = {
  args: { statusFilter: 'INACTIVE', resultCount: 5 },
};

/**
 * The group-push bucket selected: apps with Group Push on that push no groups —
 * a configured integration doing no work.
 */
export const PushesNothingFilter: Story = {
  args: { groupsFilter: 'no-groups', resultCount: 2 },
};

/** Sorted by created date, descending (newest first). */
export const SortedByCreatedDesc: Story = {
  args: { sortBy: 'created', sortDesc: true },
};
