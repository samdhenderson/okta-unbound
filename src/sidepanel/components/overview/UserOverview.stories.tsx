import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import UserOverview from './UserOverview';
import { mockUsers } from '../../../test/mocks/handlers';

/**
 * Overview tab for a single Okta user: profile card, stat grid, quick actions,
 * and the user-comparison launcher. Loads user details + memberships via
 * `chrome.tabs.sendMessage` directly on mount (not through `useOktaApi`).
 */
const meta = {
  title: 'Overview/UserOverview',
  component: UserOverview,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    userId: mockUsers[0].id,
    userName: `${mockUsers[0].profile.firstName} ${mockUsers[0].profile.lastName}`,
    targetTabId: 1,
    onTabChange: fn(),
    oktaOrigin: 'https://example.okta.com',
  },
} satisfies Meta<typeof UserOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default render. This component fetches through `chrome.tabs.sendMessage`
 * directly rather than `useOktaApi`, so there is no per-story hook to inject a
 * successful `{ success, data }` envelope — the story environment's benign
 * `chrome.tabs.sendMessage` fake resolves `{ ok: true }`, which this component
 * treats as a failed fetch and renders as a danger `AlertMessage`. That settled
 * error state is what this story compiles and renders.
 */
export const Default: Story = {};
