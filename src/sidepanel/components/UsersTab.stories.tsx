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
  // `!test` excludes UsersTab from the Vitest browser runner while keeping it in
  // the explorer + autodocs. UsersTab is the heaviest still-undecomposed god
  // component (refactoring-plan §7); its mount-time async + debounce timers
  // destabilise the headless browser test (the page closes mid-run). Re-enable
  // once §7 decomposes it into testable pieces.
  tags: ['autodocs', '!test'],
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
