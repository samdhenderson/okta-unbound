import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupOverview from './GroupOverview';
import { useOktaApi, makeUseOktaApiValue } from '../../../../.storybook/mocks/useOktaApi.mock';
import { mockUsers } from '../../../test/mocks/handlers';

/**
 * Overview tab for a single Okta group: quick stats, bulk actions, and the
 * member explorer. Fetches all members via {@link useOktaApi} on mount.
 */
const meta = {
  title: 'Overview/GroupOverview',
  component: GroupOverview,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Overview tab for a single Okta group: quick stats, bulk actions, and the member explorer.\n\n' +
          "Loads the group's full membership (via the scheduler/content-script path in " +
          '{@link useOktaApi}), derives status counts for the stat cards, and hosts the ' +
          'bulk operations (remove deprovisioned, export) plus the in-group ' +
          '{@link MemberExplorer} (search, composition reports, MFA scan).\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs), ' +
          '[Contexts](?path=/docs/internals-contexts--docs), ' +
          '[Storage & cache](?path=/docs/internals-storage-cache--docs), ' +
          '[Shared utilities](?path=/docs/internals-shared-utilities--docs)',
      },
    },
  },
  args: {
    groupId: 'group-default',
    groupName: 'Engineering Team',
    targetTabId: 1,
    onTabChange: fn(),
    oktaOrigin: 'https://example.okta.com',
  },
} satisfies Meta<typeof GroupOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A group with a full mixed-status membership loaded from the entity cache. */
export const Default: Story = {
  args: { groupId: 'group-default' },
  beforeEach: () => {
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({ getAllGroupMembers: fn(async () => mockUsers) }),
    );
  },
};

/** No `oktaOrigin` known yet — the Admin Console link is hidden. */
export const NoOktaOrigin: Story = {
  args: { groupId: 'group-no-origin', oktaOrigin: null },
  beforeEach: () => {
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({ getAllGroupMembers: fn(async () => mockUsers) }),
    );
  },
};

/** An empty group — zero members, all stat cards at zero. */
export const Empty: Story = {
  args: { groupId: 'group-empty', groupName: 'Empty Group' },
  beforeEach: () => {
    useOktaApi.mockReturnValue(makeUseOktaApiValue({ getAllGroupMembers: fn(async () => []) }));
  },
};

/** Members are still loading — full-panel spinner. */
export const Loading: Story = {
  args: { groupId: 'group-loading' },
  beforeEach: () => {
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({
        isLoading: true,
        getAllGroupMembers: fn(() => new Promise(() => {})),
      }),
    );
  },
};

/** Member load failed — inline danger alert with a retry action. */
export const ErrorState: Story = {
  args: { groupId: 'group-error' },
  beforeEach: () => {
    useOktaApi.mockReturnValue(
      makeUseOktaApiValue({
        getAllGroupMembers: fn(async () => {
          throw new Error('Failed to load group members.');
        }),
      }),
    );
  },
};
