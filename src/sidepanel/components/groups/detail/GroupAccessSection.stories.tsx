import type { Meta, StoryObj } from '@storybook/react-vite';
import GroupAccessSection from './GroupAccessSection';
import type { AppGrant, RoleGrant } from '../../../hooks/useGroupAccessGrants';

/** Two apps this group is assigned to. */
const apps: AppGrant[] = [
  { id: '0oaFAKEAPP1', label: 'Salesforce' },
  { id: '0oaFAKEAPP2', label: 'Slack' },
];

/** Two admin roles this group grants — never rendered with a resource scope. */
const roles: RoleGrant[] = [
  { id: 'raFAKEROLE1', label: 'Application Administrator' },
  { id: 'raFAKEROLE2', label: 'Help Desk Administrator' },
];

const meta = {
  title: 'Groups/GroupAccessSection',
  component: GroupAccessSection,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Answers the one question the Group Detail view never answered before: "what does membership in ' +
          'this group actually buy?" — the apps it is assigned to, plus any admin roles it grants every member.\n\n' +
          'Roles are never printed by name alone: `GET /api/v1/groups/{id}/roles` reports the role type but not ' +
          'which apps or groups it is scoped to, so each role is paired with a "role assigned (scope not shown)" ' +
          'caveat badge rather than presented as a resolved permission.\n\n' +
          'The admin-roles read commonly 403s for a non-super-admin session — an expected permission gap, not a ' +
          "failure — so it degrades to a **hidden** subsection (`rolesStatus: 'unavailable'`) instead of an " +
          'alert. That is deliberately distinct from a *confirmed* empty roles list ' +
          '(`rolesStatus: \'available\'`, `roles: []`), which renders as an explicit "No admin role granted." — ' +
          'see `RolesUnavailable` vs `Empty` below.\n\n' +
          '**Related internals:** [Hooks](?path=/docs/internals-hooks--docs)',
      },
    },
  },
  argTypes: {
    apps: { description: 'Apps this group is assigned to.' },
    appsStatus: { description: "Status of the app-assignment read ('loading'/'done'/'error')." },
    appsError: { description: 'Error message when the app-assignment read failed.' },
    roles: { description: 'Admin roles granted to every member of this group.' },
    rolesStatus: {
      description:
        "'loading' while in flight; 'available' once the read succeeds (roles is a confirmed, possibly " +
        "empty, list); 'unavailable' when the read failed (most commonly a 403) — hides the subsection " +
        'rather than claiming there are no roles.',
    },
  },
  args: {
    apps: [],
    appsStatus: 'loading',
    appsError: null,
    roles: [],
    rolesStatus: 'loading',
  },
} satisfies Meta<typeof GroupAccessSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Both the app-assignment and admin-roles reads are still in flight. */
export const Loading: Story = {};

/** Confirmed: no app assignment and no admin role — a real "grants nothing" answer. */
export const Empty: Story = {
  args: { appsStatus: 'done', apps: [], rolesStatus: 'available', roles: [] },
};

/** The app-assignment read failed. */
export const ErrorState: Story = {
  args: {
    appsStatus: 'error',
    appsError: 'App assignments could not be loaded.',
    rolesStatus: 'available',
    roles: [],
  },
};

/** Assigned to two apps and carries two admin roles, each with its scope caveat. */
export const AppsAndRoles: Story = {
  args: { appsStatus: 'done', apps, rolesStatus: 'available', roles },
};

/**
 * Assigned to apps, but the roles read 403'd for this session — the roles
 * subsection is hidden rather than shown as empty or as an alert.
 */
export const RolesUnavailable: Story = {
  args: { appsStatus: 'done', apps, rolesStatus: 'unavailable', roles: [] },
};
