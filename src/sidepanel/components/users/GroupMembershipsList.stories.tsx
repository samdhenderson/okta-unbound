import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GroupMembershipsList from './GroupMembershipsList';
import Button from '../shared/Button';
import { mockGroup } from '../../../test/mocks/handlers';
import type { GroupMembership } from '../../../shared/types';

const directMembership: GroupMembership = {
  group: mockGroup,
  membershipType: 'DIRECT',
};

const ruleMembership: GroupMembership = {
  group: {
    id: 'group456',
    type: 'OKTA_GROUP',
    profile: {
      name: 'Engineering Team',
      description: 'All engineering department employees',
    },
  },
  membershipType: 'RULE_BASED',
  rule: {
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
};

const unknownMembership: GroupMembership = {
  group: {
    id: 'group789',
    type: 'APP_GROUP',
    profile: {
      name: 'Salesforce Users',
    },
  },
  membershipType: 'UNKNOWN',
};

/** Card listing a user's group memberships, split into direct vs rule-based badges. */
const meta = {
  title: 'Users/GroupMembershipsList',
  component: GroupMembershipsList,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    memberships: [directMembership, ruleMembership],
    isLoading: false,
    onNavigateToRule: fn(),
  },
} satisfies Meta<typeof GroupMembershipsList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Mix of direct and rule-based memberships. */
export const Default: Story = {};

/** Spinner shown while memberships are being fetched. */
export const Loading: Story = {
  args: { memberships: [], isLoading: true },
};

/** User belongs to no groups. */
export const Empty: Story = {
  args: { memberships: [] },
};

/** The group currently being viewed is visually highlighted. */
export const CurrentGroupHighlighted: Story = {
  args: { currentGroupId: mockGroup.id },
};

/** Deep links to the Okta admin console render when an org origin is known. */
export const WithOktaOriginLinks: Story = {
  args: { oktaOrigin: 'https://example.okta.com' },
};

/** Caller-supplied header controls (e.g. an "Add to Group" button). */
export const WithHeaderActions: Story = {
  args: {
    actions: (
      <Button variant="primary" size="sm" onClick={fn()}>
        Add to Group
      </Button>
    ),
  },
};

/** Includes a membership whose type could not be classified. */
export const WithUnknownMembershipType: Story = {
  args: { memberships: [directMembership, ruleMembership, unknownMembership] },
};
