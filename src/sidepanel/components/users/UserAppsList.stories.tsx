import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import UserAppsList from './UserAppsList';
import { APP_SOURCE_COPY } from './appSourceSummary';
import { NavigationProvider } from '../../contexts/NavigationContext';
import type { GroupMembership } from '../../../shared/types';
import type { UserAppAssignment } from '../../hooks/useOktaApi/userOperations';

const handlers = { rule: fn(), group: fn(), user: fn(), app: fn(), policy: fn() };

const SALES_GROUP = '00gFAKE00000000000001';
const ADMINS_GROUP = '00gFAKE00000000000002';
const WORKDAY_GROUP = '00gFAKE00000000000003';

const membership = (
  id: string,
  name: string,
  over: Partial<GroupMembership> = {},
): GroupMembership => ({
  group: { id, type: 'OKTA_GROUP', profile: { name } },
  membershipType: 'RULE_BASED',
  rules: [
    {
      id: '0prFAKErule00001',
      name: 'EMEA sales',
      status: 'ACTIVE',
      conditionExpression: 'user.department == "Sales"',
      groupIds: [id],
      userAttributes: ['department'],
    },
  ],
  attribution: 'exact',
  ...over,
});

const MEMBERSHIPS: GroupMembership[] = [
  membership(SALES_GROUP, 'sales.emea'),
  membership(ADMINS_GROUP, 'okta.admins', { membershipType: 'DIRECT', rules: [] }),
  membership(WORKDAY_GROUP, 'workday.contractors', {
    group: { id: WORKDAY_GROUP, type: 'APP_GROUP', profile: { name: 'workday.contractors' } },
    rules: [],
  }),
];

const APPS: UserAppAssignment[] = [
  // The row the old model could not express: Okta reports a DIRECT assignment
  // *and* names a granting group in the same response. Both facts are true.
  {
    id: '0oaFAKEapp000001',
    label: 'Salesforce',
    scope: 'USER',
    grantGroupId: SALES_GROUP,
  },
  // A privileged app, granted through a group.
  {
    id: '0oaFAKEapp000002',
    label: 'Okta Admin Console',
    scope: 'GROUP',
    grantGroupId: ADMINS_GROUP,
  },
  // Group-scoped, group named, and that group is itself app-mastered.
  {
    id: '0oaFAKEapp000003',
    label: 'Workday',
    scope: 'GROUP',
    grantGroupId: WORKDAY_GROUP,
  },
  // Group-scoped and unresolved: Okta said "a group", and named none.
  { id: '0oaFAKEapp000004', label: 'Figma', scope: 'GROUP' },
  // A plain direct assignment, no group anywhere in the answer.
  { id: '0oaFAKEapp000005', label: 'Zoom', scope: 'USER' },
  // No scope at all — unknown, which is neither "direct" nor "via group".
  { id: '0oaFAKEapp000006', label: 'Slack' },
];

/** Which apps this user has, and which group grants each one. */
const meta = {
  title: 'Users/UserAppsList',
  component: UserAppsList,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '**The group is named on load, and it costs nothing extra.** An earlier cut of this design put a ' +
          '"Name the group" button on every group-granted row, on the assumption that naming the grantor cost a ' +
          'request per app. It does not: `getUserApps` already asks for `expand=user/{id}`, and Okta names the ' +
          "granting group in that embed's `_links.group.href` — the panel was parsing it away. So there is no " +
          'per-row button here at all.\n\n' +
          '**A `Direct` badge and a `Through {group}` line are not in tension.** Okta reports a *single* scope ' +
          'per app-user and prefers `USER` when a user is both directly assigned and in an assigned group. ' +
          '`Direct` can therefore only mean "there is a direct assignment" — never "direct only", never "not via ' +
          'a group". The first row below carries both statements at once, which is the thing the comparison ' +
          "view's four-state indicator could never say, and the reason this pane exists.\n\n" +
          '**An unknown source is spelled out, not left blank.** A row whose grantor is not known shows the ' +
          'caveat `AppScopeIndicator` owns for that state, in italic, so a stated absence never carries the ' +
          'weight of a stated fact. The vocabulary — `Direct`, `Via group`, `Source unknown` and their exact ' +
          'caveats — is reused verbatim from that component; `appSourceSummary.test.ts` renders the real ' +
          'indicator and fails if the two ever drift apart.\n\n' +
          '**A partial walk never renders as a complete answer.** `complete: false` raises a standing, ' +
          'non-dismissible warning: a list short by an unknown number of apps must not be read as this ' +
          "user's whole access.\n\n" +
          'Related internals: `sidepanel/components/users/appSourceSummary`, `sidepanel/hooks/useUserApps`.',
      },
    },
  },
  decorators: [
    (Story) => (
      <NavigationProvider handlers={handlers}>
        <Story />
      </NavigationProvider>
    ),
  ],
  argTypes: {
    apps: {
      description:
        "The user's app assignments, with `grantGroupId` already filled in wherever it is known.",
    },
    memberships: {
      description:
        'The user’s group memberships — used only to *name* a group Okta already credited, never to infer one.',
    },
    isLoading: { description: 'Shows row placeholders instead of the list.' },
    complete: {
      description:
        'Whether the pagination walk finished. `false` raises the non-dismissible incompleteness warning.',
    },
    oktaOrigin: { description: 'Origin for the per-row admin deep links; they hide when absent.' },
  },
  args: {
    apps: APPS,
    memberships: MEMBERSHIPS,
    isLoading: false,
    complete: true,
    oktaOrigin: 'https://example.okta.com',
  },
} satisfies Meta<typeof UserAppsList>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Every state on one screen: the three badges, the row that states two facts at
 * once, an unresolved row, and a privileged app.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // All three badge states are present and are three different words, so the
    // distinction never rides on colour.
    await expect(canvas.getAllByText('Direct')).toHaveLength(2);
    await expect(canvas.getAllByText('Via group')).toHaveLength(3);
    await expect(canvas.getByText('Source unknown')).toBeInTheDocument();

    // The row that carries both facts: a Direct badge AND a named group.
    await expect(canvas.getByText('Through sales.emea')).toBeInTheDocument();

    // The unresolved row says so rather than leaving its line blank. The same
    // sentence legitimately appears more than once — truncated on the row, on the
    // badge's tooltip, and in full inside the (collapsed) disclosure — so this
    // asserts that it is stated at all, not where.
    //
    // Read from the module that owns the copy rather than retyped: a story that
    // restates the prose goes green while asserting a sentence the pane no longer
    // says, which is worse than going red.
    expect(canvas.getAllByText(APP_SOURCE_COPY.GROUP.caveat).length).toBeGreaterThan(0);

    // The summary accounts for every bucket that is non-zero.
    await expect(canvas.getByText('2 direct · 3 via group · 1 unknown source')).toBeInTheDocument();
  },
};

/**
 * The `USER`-scope row that also names a group, on its own — the case the
 * comparison view's single-scope model could not express.
 */
export const DirectAndViaGroup: Story = {
  args: { apps: [APPS[0]] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Both statements, together, neither retracting the other.
    await expect(canvas.getByText('Direct')).toBeInTheDocument();
    await expect(canvas.getByText('Through sales.emea')).toBeInTheDocument();
    // And the badge still refuses exclusivity in its tooltip.
    await expect(canvas.getByTitle(/does not rule out a group path/i)).toBeInTheDocument();
  },
};

/** A group-granted row Okta named no group for: a non-answer, stated. */
export const UnresolvedSource: Story = {
  args: { apps: [APPS[3]] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Via group')).toBeInTheDocument();
    expect(canvas.getAllByText(APP_SOURCE_COPY.GROUP.caveat).length).toBeGreaterThan(0);
    // And it never invents a grantor to fill the line with.
    await expect(canvas.queryByText(/^Through /)).toBeNull();
  },
};

/** An app whose assignment is itself administrative access. */
export const PrivilegedApp: Story = {
  args: { apps: [APPS[1]] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Okta Admin Console')).toBeInTheDocument();
    await expect(canvas.getByText('Privileged')).toBeInTheDocument();
  },
};

/**
 * A row opened: the caveat in full, the `Granted through` card naming the group
 * and how that group was itself granted, and the admin deep link.
 */
export const OpenDisclosure: Story = {
  args: { apps: [APPS[2]] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: /Show how Workday is granted/i });

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await expect(canvas.getByText('Granted through')).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: 'Open group workday.contractors' }),
    ).toBeInTheDocument();
    // The granting group's own source, in the Groups pane's vocabulary.
    await expect(canvas.getByText('Managed by app')).toBeInTheDocument();
  },
};

/** Rows are placeholdered rather than spun, so nothing shifts when they land. */
export const Loading: Story = {
  args: { isLoading: true },
};

/**
 * The walk did not finish. The warning is not dismissible: it describes the list
 * itself, so it must stay true for as long as the list is on screen.
 */
export const IncompleteWalk: Story = {
  args: { complete: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole('alert');
    await expect(alert).toHaveTextContent(/may be incomplete/i);
    // No dismiss control — the caveat cannot be cleared away from the list.
    await expect(within(alert).queryByRole('button')).toBeNull();
  },
};

/** Okta reports no assignments at all — a fact about the user, not about a filter. */
export const NoApps: Story = {
  args: { apps: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No apps assigned')).toBeInTheDocument();
    // Distinct from the filtered-empty state: there is nothing to clear.
    await expect(canvas.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  },
};

/** Filtered down to nothing — a different statement, with a way back. */
export const FilteredToNothing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole('searchbox', { name: 'Filter apps or granting group' }),
      'nothing matches this',
    );

    await expect(canvas.getByText('No apps match')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Clear filters' }));
    await expect(canvas.getByText('Salesforce')).toBeInTheDocument();
  },
};

/** Filtering by the granting group's name, not just the app's. */
export const FilterByGrantingGroup: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole('searchbox', { name: 'Filter apps or granting group' }),
      'workday.contractors',
    );

    await expect(canvas.getByText('Workday')).toBeInTheDocument();
    await expect(canvas.queryByText('Salesforce')).toBeNull();
  },
};

/** One bucket at a time, with the pill counts saying what each holds. */
export const FilteredToUnknown: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^Unknown 1$/ }));

    await expect(canvas.getByText('Slack')).toBeInTheDocument();
    await expect(canvas.queryByText('Salesforce')).toBeNull();
  },
};

/**
 * The 360px floor. The app label truncates before the badge does — the source
 * verdict is the row's answer and must never be the thing that gets cut.
 */
export const Compact: Story = {
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
