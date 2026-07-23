import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, expect, within, waitFor } from 'storybook/test';
import UserOverview from './UserOverview';
import { useOktaApi, makeUseOktaApiValue } from '../../../../.storybook/mocks/useOktaApi.mock';

/** Fixture groups a user's membership read returns (the hook wraps + classifies them). */
const sampleGroups = [
  {
    id: 'g-eng',
    type: 'OKTA_GROUP',
    profile: { name: 'Engineering', description: 'All engineers' },
  },
  {
    id: 'g-admins',
    type: 'APP_GROUP',
    profile: { name: 'Okta Admins', description: 'Admin console' },
  },
];

/** A fixture user carrying `id` so the membership cache key stays per-story-distinct. */
const buildUser = (id: string) => ({
  id,
  status: 'ACTIVE',
  profile: {
    login: 'ada.lovelace@example.com',
    email: 'ada.lovelace@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
  },
});

/**
 * An endpoint-aware `makeApiRequest` spy for one user: the user read yields
 * `buildUser(id)`, the groups read yields `groups`, and every other endpoint a
 * benign empty success — mirroring the default facade mock.
 */
const userApi = (id: string, groups: unknown[]) =>
  fn(async (endpoint?: string) => {
    if (typeof endpoint === 'string') {
      if (/^\/api\/v1\/users\/[^/?]+\/groups/.test(endpoint)) {
        return { success: true, data: groups };
      }
      if (/^\/api\/v1\/users\/[^/?]+$/.test(endpoint)) {
        return { success: true, data: buildUser(id) };
      }
    }
    return { success: true, data: [] };
  });

/**
 * Overview tab for a single Okta user: profile card, stat grid, quick actions,
 * and the user-comparison launcher. Loads user details on mount through the
 * scheduler-routed `makeApiRequest` (answered by the mocked `useOktaApi` facade)
 * and memberships via {@link useUserMemberships}; both return fixture data, so the
 * loaded state renders.
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
          '(Compare / View all), and the {@link UserComparisonModal} launcher. While the ' +
          'user or memberships load it shows a full-panel spinner; a failed load renders ' +
          'an inline danger alert; a user with no memberships shows an empty groups list.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Storage & cache](?path=/docs/internals-storage-cache--docs), ' +
          '[Types](?path=/docs/internals-types--docs)',
      },
    },
  },
  argTypes: {
    userId: { description: 'Okta user id to load and summarize.' },
    userName: { description: 'Optional display name (informational; not read in render).' },
    targetTabId: {
      description: 'Browser tab hosting the Okta session; every API call is routed to it.',
    },
    onViewAllGroups: {
      description: 'Open this user in the Users tab with their full membership list loaded.',
    },
    oktaOrigin: {
      description: 'Okta org origin (unused for links here — the overview omits the deep link).',
    },
  },
  args: {
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
 * from the fixture user + memberships. The `play` asserts the loaded state renders
 * (not the "failed to load" danger alert).
 */
export const Default: Story = {
  args: { userId: 'user1' },
  beforeEach: () => {
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({ makeApiRequest: userApi('user1', sampleGroups) }),
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText('Ada Lovelace')).toBeInTheDocument());
    expect(canvas.queryByText(/failed to load/i)).not.toBeInTheDocument();
  },
};

/** User details still loading — full-panel spinner. */
export const Loading: Story = {
  args: { userId: 'user-loading' },
  beforeEach: () => {
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({ isLoading: true, makeApiRequest: fn(() => new Promise(() => {})) }),
    );
  },
};

/** A user with no group memberships — the groups preview shows its empty message. */
export const Empty: Story = {
  args: { userId: 'user-empty' },
  beforeEach: () => {
    useOktaApi.mockReturnValue(makeUseOktaApiValue({ makeApiRequest: userApi('user-empty', []) }));
  },
};

/** The user-details load failed — inline danger alert. */
export const ErrorState: Story = {
  args: { userId: 'user-error' },
  beforeEach: () => {
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({
        makeApiRequest: fn(async (endpoint?: string) => {
          if (typeof endpoint === 'string' && /^\/api\/v1\/users\/[^/?]+$/.test(endpoint)) {
            return { success: false, error: 'Failed to load user details' };
          }
          return { success: true, data: [] };
        }),
      }),
    );
  },
};
