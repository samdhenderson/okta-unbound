import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import UserDetailPanel from './UserDetailPanel';
import { mockGroup, mockUsers } from '../../../test/mocks/fixtures';
import type { GroupMembership, OktaUser } from '../../../shared/types';

const activeUser: OktaUser = {
  ...mockUsers[10],
  status: 'ACTIVE',
  created: '2023-01-15T10:00:00.000Z',
  lastLogin: '2026-07-15T08:30:00.000Z',
};

const suspendedUser: OktaUser = { ...activeUser, status: 'SUSPENDED' };

const directMembership: GroupMembership = {
  group: mockGroup,
  membershipType: 'DIRECT',
  rules: [],
  attribution: 'exact',
};

const ruleMembership: GroupMembership = {
  group: {
    id: 'group456',
    type: 'OKTA_GROUP',
    profile: { name: 'Engineering Team', description: 'All engineering department employees' },
  },
  membershipType: 'RULE_BASED',
  rules: [
    {
      id: 'rule1',
      name: 'Auto-add Engineers',
      status: 'ACTIVE',
      conditions: {
        expression: {
          value: 'String.stringContains(user.department, "Engineering")',
          type: 'urn:okta:expression:1.0',
        },
      },
    },
  ],
  attribution: 'exact',
};

/** The Users tab's selected-user surface: profile card, lifecycle actions, memberships. */
const meta = {
  title: 'Users/UserDetailPanel',
  component: UserDetailPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          "The Users tab's selected-user surface: the profile card (with the lifecycle actions in its `afterCard` slot) and the analysed group-membership list (with the Compare / Add to Group controls in its `actions` slot).\n\n" +
          "Purely presentational — the selected user, their analysed memberships and every action's state live in `useUsersTabState`, so this panel renders without touching Okta. While memberships load, the list shows a spinner.\n\n" +
          'Page-level verbs (Compare, Add to group) are deliberately **not** here: they act on the whole user, so they live in the tab’s sticky `ActionBar` above this panel (ADR-0030). They used to sit in `GroupMembershipsList`’s header slot, alongside controls acting on that one card.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs)',
      },
    },
  },
  args: {
    user: activeUser,
    oktaOrigin: null,
    memberships: [directMembership, ruleMembership],
    isLoadingMemberships: false,
    isLifecycleLoading: false,
    pendingLifecycleAction: null,
    onNavigateToRule: fn(),
    onRequestLifecycleAction: fn(),
    onCancelLifecycleAction: fn(),
    onConfirmLifecycleAction: fn(),
  },
  argTypes: {
    user: { description: 'The selected user to render.' },
    oktaOrigin: {
      description:
        'Okta origin used to build admin-console deep links; links are hidden when absent.',
    },
    memberships: {
      description: "The user's memberships, each already classified as direct or rule-based.",
    },
    isLoadingMemberships: {
      description: 'True while the memberships are being loaded/analysed.',
    },
    currentGroupId: {
      description:
        'Id of the currently detected group; highlights that group in the membership list.',
    },
    onNavigateToRule: {
      description: 'Invoked with a rule id to navigate to that rule in the Rules tab.',
    },
    isLifecycleLoading: {
      description: 'True while a confirmed lifecycle action is in flight.',
    },
    pendingLifecycleAction: {
      description: 'The lifecycle action awaiting confirmation, or `null`.',
    },
    onRequestLifecycleAction: { description: 'Arm the confirm modal for a lifecycle action.' },
    onCancelLifecycleAction: { description: 'Dismiss the lifecycle confirm modal.' },
    onConfirmLifecycleAction: { description: 'Run the armed lifecycle action.' },
  },
} satisfies Meta<typeof UserDetailPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An active user with one direct and one rule-based membership. */
export const Default: Story = {};

/** Memberships are still loading — the list shows its row skeleton. */
export const LoadingMemberships: Story = {
  args: { memberships: [], isLoadingMemberships: true },
};

/** The group open in the admin page is highlighted in the membership list. */
export const CurrentGroupHighlighted: Story = {
  args: { currentGroupId: mockGroup.id },
};

/** A suspended user — the lifecycle panel offers Unsuspend instead of Suspend. */
export const SuspendedUser: Story = {
  args: { user: suspendedUser },
};

/** A lifecycle action is armed, so its confirmation modal is open. */
export const ConfirmingSuspend: Story = {
  args: { pendingLifecycleAction: 'suspend' },
};

/** Deep links to the Okta admin console render when an org origin is known. */
export const WithOktaOriginLinks: Story = {
  args: { oktaOrigin: 'https://example.okta.com' },
};
