import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import GroupAppRow from './GroupAppRow';
import type { GroupAppRowModel } from '../groupAppSource';

const row: GroupAppRowModel = {
  id: '0oaFAKE1',
  label: 'Slack',
  status: 'ACTIVE',
  statusVariant: 'success',
  signOnMode: 'SAML_2_0',
  lastUpdated: new Date('2025-11-14T09:30:00Z'),
  push: { state: 'not-pushed' },
};

/** One app the group is assigned to, with its detail disclosure. */
const meta = {
  title: 'Groups/GroupAppRow',
  component: GroupAppRow,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'One assigned app: what it is, whether it is live, and — behind the disclosure — how ' +
          'it is wired.\n\n' +
          'This list used to be `EntityLink` chips, so a reader could not tell an `ACTIVE` SAML ' +
          'app from a deactivated bookmark without leaving the page. **Nothing here costs an ' +
          'extra request**: `GET /api/v1/groups/{id}/apps` already returned the status, sign-on ' +
          'mode and timestamps the old chip discarded at the boundary.\n\n' +
          '**Absent is absent.** An app whose row did not report a status gets no badge, not one ' +
          'reading "Unknown" — the schema catches unexpected values precisely so a row degrades ' +
          'rather than being dropped, which makes an absent field genuinely unknown.\n\n' +
          '**Push is three-state.** `unknown` (the group load’s push enrichment did not run) ' +
          'says nothing at all, because "not pushed" would turn a skipped enrichment into a ' +
          'claim. `GroupPushSection` owns the same distinction and remains the complete account: ' +
          'a group can be pushed to an app it is not assigned to, so a mapping can exist with no ' +
          'row here to hang it on.',
      },
    },
  },
  argTypes: {
    row: { description: "The row's whole rendered model, derived by `groupAppSource`." },
    expanded: { description: "Whether this row's disclosure is open. Owned by the list." },
    onToggle: { description: "Called with the app's id when the disclosure control is pressed." },
  },
  args: {
    row,
    expanded: false,
    onToggle: fn(),
    oktaOrigin: 'https://example.okta.com',
  },
  decorators: [
    // The row is an `<li>` — the list it belongs to is the Access section's.
    // Rendering one in isolation without a list parent is an axe `listitem`
    // violation, and rightly so.
    (Story) => (
      <ul className="max-w-md space-y-1.5">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof GroupAppRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Collapsed: label, sign-on mode and status. */
export const Default: Story = {};

/** Open: the app id, how it signs on, when it changed, and the way out to Okta. */
export const Expanded: Story = { args: { expanded: true } };

/** A deactivated app still lists — its status is the point. */
export const Inactive: Story = {
  args: { row: { ...row, status: 'INACTIVE', statusVariant: 'neutral' } },
};

/**
 * An app whose row reported no status, sign-on mode or timestamp. It renders as
 * absent — no badge, no lines — never as "Unknown".
 */
export const NothingReported: Story = {
  args: {
    expanded: true,
    row: {
      id: '0oaFAKE2',
      label: 'Wiki',
      statusVariant: 'neutral',
      push: { state: 'not-pushed' },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText(/unknown/i)).toBeNull();
    await expect(canvas.queryByText('Sign-on mode')).toBeNull();
    await expect(canvas.queryByText('Last updated')).toBeNull();
  },
};

/** This group's membership is pushed into a group inside the app. */
export const Pushed: Story = {
  args: {
    expanded: true,
    row: { ...row, push: { state: 'pushed', targetGroupName: 'eng-team', priority: 2 } },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Pushed')).toBeVisible();
    await expect(canvas.getByText(/Writes into eng-team\./)).toBeVisible();
    await expect(canvas.getByText(/Priority 2\./)).toBeVisible();
  },
};

/**
 * The push enrichment never ran for this group. The row says **nothing** about
 * push rather than implying the app is not pushed to.
 */
export const PushUnknown: Story = {
  args: { expanded: true, row: { ...row, push: { state: 'unknown' } } },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText('Pushed')).toBeNull();
    await expect(canvas.queryByText(/not pushed to this app/)).toBeNull();
  },
};

/** The chevron owns the disclosure, and reports which app it opened. */
export const TogglesFromTheChevron: Story = {
  play: async ({ args, canvas }) => {
    const toggle = canvas.getByRole('button', { name: 'Show details for Slack' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    await expect(args.onToggle).toHaveBeenCalledWith('0oaFAKE1');
  },
};
