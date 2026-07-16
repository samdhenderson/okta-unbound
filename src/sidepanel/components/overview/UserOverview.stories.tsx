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
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Overview tab for a single Okta user: profile, membership stats, and an ' +
          'alphabetical groups preview.\n\n' +
          "Fetches the user's details from the content script and their group " +
          'memberships via {@link useUserMemberships} (which classifies each as direct ' +
          'vs. rule-based), then renders the profile card, stat cards, a groups preview ' +
          '(Compare / View all), and the {@link UserComparisonModal} launcher.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Storage & cache](?path=/docs/internals-storage-cache--docs), ' +
          '[Types](?path=/docs/internals-types--docs)',
      },
    },
  },
  args: {
    // Matches the fixture user the chrome fake returns for `getUserDetails`.
    userId: 'user1',
    userName: 'Ada Lovelace',
    targetTabId: 1,
    onViewAllGroups: fn(),
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
