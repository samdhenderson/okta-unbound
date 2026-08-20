import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import UserAppRow from './UserAppRow';
import { APP_SOURCE_COPY, summarizeAppSources } from './appSourceSummary';
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
  {
    group: { id: WORKDAY_GROUP, type: 'APP_GROUP', profile: { name: 'workday.contractors' } },
    membershipType: 'RULE_BASED',
    rules: [],
    attribution: 'exact',
  },
];

/**
 * The row's whole model is derived, never hand-built — this goes through the real
 * `summarizeAppSources` so a story cannot express a row the pane could not
 * produce.
 */
const rowFor = (app: UserAppAssignment) => summarizeAppSources([app], MEMBERSHIPS).rows[0];

/** `scope: 'USER'` alone: Okta reports a direct assignment and credits no group. */
const directOnly = rowFor({ id: '0oaFAKEapp000005', label: 'Zoom', scope: 'USER' });

/** `scope: 'USER'` **and** a credited group. Both facts are true; the row says both. */
const directAndViaGroup = rowFor({
  id: '0oaFAKEapp000001',
  label: 'Salesforce',
  scope: 'USER',
  grantGroupId: SALES_GROUP,
});

/** `scope: 'GROUP'` with the group named — the ordinary group-granted row. */
const viaNamedGroup = rowFor({
  id: '0oaFAKEapp000003',
  label: 'Workday',
  scope: 'GROUP',
  grantGroupId: WORKDAY_GROUP,
});

/** `scope: 'GROUP'` and no group named: Okta said "a group", and named none. */
const viaUnnamedGroup = rowFor({ id: '0oaFAKEapp000004', label: 'Figma', scope: 'GROUP' });

/** No scope at all — its own state, and neither "direct" nor "via group". */
const sourceUnknown = rowFor({ id: '0oaFAKEapp000006', label: 'Slack' });

/** An app whose assignment is itself administrative access. */
const privileged = rowFor({
  id: '0oaFAKEapp000002',
  label: 'Okta Admin Console',
  scope: 'GROUP',
  grantGroupId: ADMINS_GROUP,
});

/** One app on the Users tab's Apps pane. */
const meta = {
  title: 'Users/UserAppRow',
  component: UserAppRow,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'One app assignment: which app, how Okta says it was granted, and — once known — which ' +
          'group grants it.\n\n' +
          '**A `Direct` badge and a `Through {group}` line are not in tension.** Okta reports a ' +
          'single scope per app-user and prefers `USER` when a user is both directly assigned *and* ' +
          'in an assigned group, so `Direct` can only mean "there is a direct assignment" — never ' +
          '"direct only". A row carrying both states both, which is the thing the comparison view ' +
          'could never express (ADR-0020).\n\n' +
          '**An absent source is spelled out.** With no group known the second line is not blank: ' +
          'it is the caveat `AppScopeIndicator` owns for that state, rendered *italic*, so a stated ' +
          'absence never reads with the weight of a stated fact.\n\n' +
          'The row takes an `AppSourceRow` and owns no I/O at all, which is the structural guarantee ' +
          'that scrolling a long list cannot start work.\n\n' +
          "Three of `AppScopeIndicator`'s four states are reachable here — `notCompared` is " +
          'comparison-only (two users, one loaded scope) and is excluded from `AppSourceState` at ' +
          'the type level rather than left as an unreachable branch.\n\n' +
          '**Related internals:** [Components](?path=/docs/internals-components--docs)',
      },
    },
  },
  // `ListRow as="li"` needs its list: a bare `<li>` is an axe `listitem`
  // violation and is not how the pane renders it.
  decorators: [
    (Story: () => React.ReactElement) => (
      <NavigationProvider handlers={handlers}>
        <div className="bg-canvas p-4">
          <ul className="space-y-2">
            <Story />
          </ul>
        </div>
      </NavigationProvider>
    ),
  ],
  args: {
    row: directAndViaGroup,
    oktaOrigin: 'https://example.okta.com',
  },
  argTypes: {
    row: { description: "The row's whole rendered model, derived by `appSourceSummary`." },
    oktaOrigin: {
      description: 'Origin for the admin-console deep link; the link hides when absent.',
    },
  },
} satisfies Meta<typeof UserAppRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The row that carries two facts at once: a `Direct` badge and a named granting group. */
export const Default: Story = {};

// ---------------------------------------------------------------------------
// The three states a single user's app row can be in.
// ---------------------------------------------------------------------------

/** `USER` scope, no group credited — a plain direct assignment. */
export const Direct: Story = {
  args: { row: directOnly },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Direct')).toBeInTheDocument();
    // Even alone, the badge refuses exclusivity in its caveat. The sentence is
    // read from the copy table that owns it rather than retyped here, so the
    // story cannot drift from `AppScopeIndicator`'s vocabulary; it legitimately
    // rides on more than one node, so this asserts that it is stated — not where.
    expect(canvas.getAllByTitle(APP_SOURCE_COPY.USER.caveat).length).toBeGreaterThan(0);
  },
};

/** `USER` scope **with** a credited group. Neither statement retracts the other. */
export const DirectAndViaGroup: Story = {
  args: { row: directAndViaGroup },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Direct')).toBeInTheDocument();
    await expect(canvas.getByText('Through sales.emea')).toBeInTheDocument();
  },
};

/** `GROUP` scope with the group named — the row Okta answered completely. */
export const ViaGroup: Story = {
  args: { row: viaNamedGroup },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Via group')).toBeInTheDocument();
    await expect(canvas.getByText('Through workday.contractors')).toBeInTheDocument();
  },
};

/** No scope reported at all: its own state, stated in words rather than left blank. */
export const SourceUnknown: Story = {
  args: { row: sourceUnknown },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Source unknown')).toBeInTheDocument();
  },
};

/**
 * `GROUP` scope and **no group named**. The second line states the non-answer in
 * italic rather than saying "Direct", and no grantor is invented to fill it.
 */
export const UnresolvedSource: Story = {
  args: { row: viaUnnamedGroup },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Via group')).toBeInTheDocument();
    // The non-answer is stated, in the words `appSourceSummary` owns — read from
    // the table rather than retyped, so a copy edit there cannot leave this story
    // asserting a sentence the pane no longer says. It legitimately appears more
    // than once (truncated on the row, on the badge's `title`, in full inside the
    // collapsed disclosure), so this asserts that it is stated — not where.
    expect(canvas.getAllByText(APP_SOURCE_COPY.GROUP.caveat).length).toBeGreaterThan(0);
    await expect(canvas.queryByText(/^Through /)).toBeNull();
  },
};

/** An app whose assignment is itself administrative access. */
export const PrivilegedApp: Story = {
  args: { row: privileged },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Privileged')).toBeInTheDocument();
  },
};

/**
 * The disclosure opened: the caveat in full, the `Granted through` card naming
 * the group and how *that* group was itself granted, and the admin deep link.
 */
export const OpenDisclosure: Story = {
  args: { row: viaNamedGroup },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Show how Workday is granted' });

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await expect(canvas.getByText('Granted through')).toBeInTheDocument();
    // The granting group's own source, in the Groups pane's vocabulary.
    await expect(canvas.getByText('Managed by app')).toBeInTheDocument();
  },
};

/** No origin known, so the disclosure carries no link rather than a broken one. */
export const WithoutOktaOrigin: Story = {
  args: { row: viaNamedGroup, oktaOrigin: null },
};

/**
 * The 360px floor. The app label truncates before the badge does — the source
 * verdict is the row's answer and must never be the thing that gets cut.
 */
export const Compact: Story = {
  args: { row: privileged },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
