import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import UserDetailPanel from './UserDetailPanel';
import { NavigationProvider } from '../../contexts/NavigationContext';
import { mockGroup, mockUsers } from '../../../test/mocks/fixtures';
import { DEFAULT_PROFILE_DISPLAY_CONFIG } from '../../../shared/storage/profileDisplayStore';
import type { AttributeDescriptor } from './profileAttributes';
import type { GroupMembership, OktaUser } from '../../../shared/types';
import type { UserAppAssignment } from '../../hooks/useOktaApi/userOperations';
import type { UserDetailPane } from '../../hooks/useUserDetailPanes';

const handlers = { rule: fn(), group: fn(), user: fn(), app: fn(), policy: fn() };

const activeUser: OktaUser = {
  ...mockUsers[10],
  status: 'ACTIVE',
  created: '2023-01-15T10:00:00.000Z',
  lastLogin: '2026-07-15T08:30:00.000Z',
};

const ENGINEERING_GROUP = '00gFAKE00000000000010';

const directMembership: GroupMembership = {
  group: mockGroup,
  membershipType: 'DIRECT',
  rules: [],
  attribution: 'exact',
};

const ruleMembership: GroupMembership = {
  group: {
    id: ENGINEERING_GROUP,
    type: 'OKTA_GROUP',
    profile: { name: 'Engineering Team', description: 'All engineering department employees' },
  },
  membershipType: 'RULE_BASED',
  rules: [
    {
      id: '0prFAKErule00001',
      name: 'Auto-add Engineers',
      status: 'ACTIVE',
      conditionExpression: 'String.stringContains(user.department, "Engineering")',
      groupIds: [ENGINEERING_GROUP],
      userAttributes: ['department'],
    },
  ],
  attribution: 'exact',
};

const MEMBERSHIPS = [directMembership, ruleMembership];

const APPS: UserAppAssignment[] = [
  {
    id: '0oaFAKEapp000001',
    label: 'Salesforce',
    scope: 'USER',
    grantGroupId: ENGINEERING_GROUP,
    isProfileSource: false,
  },
  {
    id: '0oaFAKEapp000002',
    label: 'Workday',
    scope: 'GROUP',
    grantGroupId: ENGINEERING_GROUP,
    // This user's profile source, which is why the Profile pane's mastered
    // attributes render locked in these stories.
    isProfileSource: true,
  },
  { id: '0oaFAKEapp000003', label: 'Figma', scope: 'GROUP', isProfileSource: false },
];

const APPS_BY_GROUP: Record<string, string[]> = {
  [ENGINEERING_GROUP]: ['Salesforce', 'Workday'],
};

const attr = (
  name: string,
  label: string,
  value: string,
  over: Partial<AttributeDescriptor> = {},
): AttributeDescriptor => ({
  key: `profile.${name}`,
  name,
  label,
  kind: 'base',
  value,
  raw: value,
  isEmpty: value === '',
  ...over,
});

const ATTRIBUTES: AttributeDescriptor[] = [
  attr('id', 'User ID', '00uFAKE0001', { key: 'id', kind: 'system', mono: true }),
  attr('status', 'Status', 'ACTIVE', { key: 'status', kind: 'system' }),
  attr('login', 'Login', 'user@example.com'),
  attr('email', 'Email', 'user@example.com'),
  attr('firstName', 'First Name', 'Ada'),
  attr('lastName', 'Last Name', 'Lovelace'),
  attr('department', 'Department', 'Engineering'),
  attr('title', 'Title', 'Staff Platform Engineer'),
  attr('costCenter', 'Cost Center', 'CC-4471', { kind: 'custom' }),
];

const RULE_READS: Record<string, string[]> = {
  department: ['Auto-add Engineers'],
};

/**
 * The user-detail rung: three tabbed panes of one card — Groups, Apps and Profile.
 */
const meta = {
  title: 'Users/UserDetailPanel',
  component: UserDetailPanel,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    // heading-order disabled: the panel renders as a page fragment out of its
    // heading context (no surrounding app shell), so axe flags isolated headings.
    a11y: { config: { rules: [{ id: 'heading-order', enabled: false }] } },
    docs: {
      description: {
        component:
          'The Users tab’s selected-user surface: **Groups**, **Apps** and **Profile** as three panes ' +
          'of one card, the same three questions the native Okta admin console splits a user into — ' +
          'but with source attribution on every row.\n\n' +
          '**Panes are hidden, not unmounted** (ADR-0016/ADR-0018). Each pane owns its filter text, ' +
          'source pills and open disclosures as plain local state, and all of it survives a pane ' +
          'switch. The inactive panes carry the `hidden` *attribute* as well as the class, so they ' +
          'leave the accessibility tree — without it, three panes of rows would answer a role query ' +
          'at once.\n\n' +
          '**A count it does not have is omitted, never zeroed** (ADR-0032 §2a). The Apps tab shows ' +
          'no count until the pane has been visited and the list resolved: a user with no apps and a ' +
          'user whose apps were never fetched are different answers, and only one of them is `0`.\n\n' +
          '**Page-level verbs are deliberately elsewhere.** Compare, Add to Group and the ' +
          'account-state verbs act on the whole user, so they live in `UserActionBar` above this card ' +
          '(ADR-0030).\n\n' +
          'Related internals: `sidepanel/hooks/useUserDetailPanes`, `sidepanel/hooks/useUserApps`.',
      },
    },
  },
  decorators: [
    (Story) => (
      <NavigationProvider handlers={handlers}>
        <div className="bg-canvas p-4">
          <Story />
        </div>
      </NavigationProvider>
    ),
  ],
  args: {
    user: activeUser,
    oktaOrigin: null,
    pane: 'groups',
    onPaneChange: fn(),
    memberships: MEMBERSHIPS,
    isLoadingMemberships: false,
    apps: APPS,
    isLoadingApps: false,
    appsComplete: true,
    appsByGroupId: APPS_BY_GROUP,
    attributes: ATTRIBUTES,
    isLoadingProfile: false,
    profileConfig: DEFAULT_PROFILE_DISPLAY_CONFIG,
    onProfileConfigChange: fn(),
    onProfileConfigReset: fn(),
    ruleReads: RULE_READS,
  },
  argTypes: {
    user: { description: 'The selected user to render.' },
    oktaOrigin: {
      description:
        'Okta origin used to build admin-console deep links; links are hidden when absent.',
    },
    pane: {
      description: 'Which pane is on screen. Lifted — the header and the strip read it too.',
    },
    onPaneChange: {
      description: 'Selects a pane. The rung’s apps / schema loads are gated on it.',
    },
    memberships: {
      description: 'The user’s memberships, each already classified as direct or rule-based.',
    },
    isLoadingMemberships: { description: 'True while the memberships are being loaded/analysed.' },
    currentGroupId: {
      description:
        'Id of the currently detected group; highlights that group in the membership list.',
    },
    apps: { description: 'The user’s app assignments, granting group filled in where known.' },
    appsComplete: {
      description: 'False when the app pagination walk did not finish; the pane must say so.',
    },
    appsByGroupId: {
      description:
        'Applications each group grants, keyed by group id. **Absent is not empty** — a group with no entry renders no "Also grants" line.',
    },
    attributes: { description: 'Every attribute of this user’s profile, empty ones included.' },
    ruleReads: {
      description:
        'Attribute name → the rules that read it *and* currently grant this user access.',
    },
  },
} satisfies Meta<typeof UserDetailPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The Groups pane — the default, so opening a user never pays for the other two. */
export const GroupsPane: Story = {};

/** The Apps pane: which apps the user has, and the group behind each one. */
export const AppsPane: Story = {
  args: { pane: 'apps' },
};

/** The Profile pane: every attribute, in the admin's categories, with rule reads marked. */
export const ProfilePane: Story = {
  args: { pane: 'profile' },
};

/** Memberships are still loading — the Groups tab shows no count and the pane shows skeletons. */
export const LoadingMemberships: Story = {
  args: { memberships: [], isLoadingMemberships: true },
};

/**
 * The Apps pane before its first load. The tab carries **no count at all** rather
 * than a `0` — an unvisited pane has not answered the question.
 */
export const AppsNotLoadedYet: Story = {
  args: { pane: 'apps', apps: [], isLoadingApps: true, appsByGroupId: {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const appsTab = canvas.getByRole('tab', { name: /^Apps$/ });
    await expect(appsTab).not.toHaveTextContent('0');
  },
};

/** The app pagination walk did not finish, so the pane carries a standing caveat. */
export const IncompleteAppWalk: Story = {
  args: { pane: 'apps', appsComplete: false },
};

/** The group open in the admin page is highlighted in the membership list. */
export const CurrentGroupHighlighted: Story = {
  args: { currentGroupId: mockGroup.id },
};

/** Deep links to the Okta admin console render when an org origin is known. */
export const WithOktaOriginLinks: Story = {
  args: { oktaOrigin: 'https://example.okta.com' },
};

/**
 * A pane switch keeps the pane you left mounted: type into the Groups filter, go to
 * Profile, come back, and the filter is still there. This is the ADR-0016 contract
 * the `hidden` attribute (not just the class) exists to make testable.
 */
export const PaneStateSurvivesASwitch: Story = {
  render: (args) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- a story render fn is a component
    const [pane, setPane] = useState<UserDetailPane>('groups');
    return <UserDetailPanel {...args} pane={pane} onPaneChange={setPane} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filter = canvas.getByLabelText('Filter group memberships');
    await userEvent.type(filter, 'Engineering');

    await userEvent.click(canvas.getByRole('tab', { name: /Profile/ }));
    await userEvent.click(canvas.getByRole('tab', { name: /Groups/ }));

    await expect(canvas.getByLabelText('Filter group memberships')).toHaveValue('Engineering');
  },
};

/** The 360px floor: three tabs with counts must not overflow the panel. */
export const Narrow: Story = {
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
