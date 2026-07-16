import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import UsersTab from './UsersTab';

/**
 * Users tab: search users and analyse their group memberships (search results
 * and the selected user come from live Okta search, so this shell starts empty).
 */
const meta = {
  title: 'Components/UsersTab',
  component: UsersTab,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    targetTabId: 1,
    currentGroupId: undefined,
    onNavigateToRule: fn(),
  },
} satisfies Meta<typeof UsersTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Connected Okta tab, no search performed yet — shows the search bar and empty state. */
export const Default: Story = {};

/** No Okta tab connected — search and lifecycle actions are unavailable. */
export const Disconnected: Story = {
  args: { targetTabId: undefined },
};

/** A group is detected on the page, so a matching membership row is highlighted once a user is selected. */
export const WithCurrentGroup: Story = {
  args: { currentGroupId: 'group123' },
};
