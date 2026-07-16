import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, expect, within, waitFor } from 'storybook/test';
import UserOverview from './UserOverview';

/**
 * Overview tab for a single Okta user: profile card, stat grid, quick actions,
 * and the user-comparison launcher. Loads user details + memberships via
 * `chrome.tabs.sendMessage` directly on mount (not through `useOktaApi`); the
 * Storybook `chrome` fake answers those `getUserDetails`/`getUserGroups` reads
 * with fixture data, so the loaded state renders.
 */
const meta = {
  title: 'Overview/UserOverview',
  component: UserOverview,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    // Matches the fixture user the chrome fake returns for `getUserDetails`.
    userId: 'user1',
    userName: 'Ada Lovelace',
    targetTabId: 1,
    onTabChange: fn(),
    oktaOrigin: 'https://example.okta.com',
  },
} satisfies Meta<typeof UserOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Loaded overview: profile card, group stat grid, and quick actions, populated
 * from the fixture user + memberships the `chrome` fake returns. The `play`
 * asserts the loaded state renders (not the "failed to load" danger alert).
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText('Ada Lovelace')).toBeInTheDocument());
    expect(canvas.queryByText(/failed to load/i)).not.toBeInTheDocument();
  },
};
