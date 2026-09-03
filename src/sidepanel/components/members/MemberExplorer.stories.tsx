import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { MemberMfaResult, OktaUser } from '../../../shared/types';
import MemberExplorer from './MemberExplorer';
import { mockUsers } from '../../../test/mocks/fixtures';

const mfaResults = new Map<string, MemberMfaResult>(
  mockUsers.map((user, i) => [
    user.id,
    {
      userId: user.id,
      factors: [],
      enrolled: i % 4 !== 0,
      factorCount: i % 4 === 0 ? 0 : (i % 4) + 1,
      factorLabels: i % 4 === 0 ? [] : ['Okta Verify (Fastpass)'].concat(i % 4 >= 2 ? ['SMS'] : []),
    },
  ]),
);

/** Orchestrator for in-group member search, faceting, MFA scanning, and listing. */
const meta = {
  title: 'Members/MemberExplorer',
  component: MemberExplorer,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Orchestrator for in-group member search, faceting, MFA, and listing.\n\n' +
          '**One control line, one drawer.** The tab used to stack seven surfaces above its ' +
          'first member row; now a single band carries search, the drawer trigger, the active ' +
          'filters as chips, and how much of the roster survived them, and every remaining ' +
          'control is in `MemberFilterDrawer`.\n\n' +
          "Owns the explorer's client-side state — debounced search, sort field/direction, and " +
          'the paged visible window — and derives the filtered/sorted list via the pure ' +
          '`memberAnalytics` helpers. The facet filter set itself lives in `useMemberFilters`, ' +
          'which also takes the one-shot `pendingFilter` request the Insights tab uses to hand ' +
          'a value over. MFA scan results are owned by the caller, so the scan lifecycle ' +
          '(idle → confirming → scanning → complete) is driven by props.\n\n' +
          '**Related internals:** [Types](?path=/docs/internals-types--docs)',
      },
    },
  },
  argTypes: {
    members: { description: "The group's full member set (the explorer filters/sorts locally)." },
    isReloading: {
      description:
        'True while the member set is being re-fetched behind the explorer; the list swaps to skeleton rows.',
    },
    mfaResults: { description: 'Per-member MFA scan results, or null before a scan has run.' },
    scanStatus: { description: 'Current MFA scan lifecycle status.' },
    onRunScan: { description: 'Start the MFA scan.' },
    onRequestConfirm: { description: 'Request the confirmation gate (used for large groups).' },
    onCancelConfirm: { description: 'Dismiss the confirmation gate.' },
    oktaOrigin: {
      description: 'Okta org origin for member Admin Console links (null when unknown).',
    },
  },
  args: {
    members: mockUsers,
    isReloading: false,
    mfaResults: null,
    scanStatus: 'idle',
    onRunScan: fn(),
    onRequestConfirm: fn(),
    onCancelConfirm: fn(),
    oktaOrigin: null,
  },
} satisfies Meta<typeof MemberExplorer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No MFA scan yet run: search, composition, and the member list are all live. */
export const Default: Story = {};

/** Confirmation gate shown before scanning a large group. */
export const ConfirmingScan: Story = {
  args: { scanStatus: 'confirming' },
};

/** MFA scan in progress. */
export const Scanning: Story = {
  args: { scanStatus: 'scanning' },
};

/** MFA scan complete: the drawer's factor filters and per-member factor tags are live. */
export const ScanComplete: Story = {
  args: { mfaResults, scanStatus: 'complete' },
};

/** An empty group renders the explorer's empty state throughout. */
export const Empty: Story = {
  args: { members: [] },
};

/**
 * Thirty members over three departments and two titles, so an attribute reveal
 * has something to reveal and picking a value visibly narrows the list.
 */
const spreadMembers: OktaUser[] = Array.from({ length: 30 }, (_, i) => ({
  id: `spread${i + 1}`,
  status: 'ACTIVE',
  profile: {
    login: `spread${i + 1}@example.com`,
    email: `spread${i + 1}@example.com`,
    firstName: `First${i + 1}`,
    lastName: `Last${i + 1}`,
    department: ['Engineering', 'Support', 'Finance'][i % 3],
    title: i % 2 === 0 ? 'Manager' : 'Individual Contributor',
  },
}));

/**
 * The drawer, end to end: open it, pick an attribute, pick a value in the
 * shared reveal, and the filter arrives as a chip on the always-visible line.
 *
 * The reveal is `BreakdownDetailsModal` — the same one the Insights tab opens.
 * There is deliberately no second value picker.
 */
export const PickAValueThroughTheDrawer: Story = {
  args: { members: spreadMembers },
  play: async ({ canvas, canvasElement }) => {
    const trigger = canvas.getByRole('button', { name: 'Filters' });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(
      canvas.getByRole('button', { name: 'Department: choose a value to filter by' }),
    );

    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await userEvent.click(within(dialog).getByText('Support'));

    await expect(canvas.getByText('Department: Support')).toBeVisible();
    await expect(canvas.getByText('10 of 30')).toBeVisible();
  },
};

/**
 * A filter you cannot see is worse than a control you cannot reach — so the
 * chip sits on the visible line, and removing it needs no drawer at all. Its
 * accessible name says *which* filter it drops; "Remove" alone is useless in a
 * row of five.
 */
export const ChipRemovesTheFilterWithoutTheDrawer: Story = {
  args: { members: spreadMembers },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Filters' }));
    await userEvent.click(
      canvas.getByRole('button', { name: 'Department: choose a value to filter by' }),
    );
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await userEvent.click(within(dialog).getByText('Support'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }));

    // Close the drawer: the chip is on the line above it, not inside it.
    await userEvent.click(canvas.getByRole('button', { name: 'Filters, 1 applied' }));

    await userEvent.click(
      canvas.getByRole('button', { name: 'Remove Department: Support filter' }),
    );
    await expect(canvas.queryByText('Department: Support')).toBeNull();
    await expect(canvas.getByText('30 of 30')).toBeVisible();
  },
};

/**
 * Closed, the drawer's controls are out of the tab order *and* the accessible
 * tree (`inert`) while staying mounted, so the panel keeps its own state across
 * an open/close. A `hidden` class would get only the first half.
 *
 * **Unverified visually here:** the headless runner loads no Tailwind, so
 * nothing about the collapsed drawer's height — the `.disclose` 0fr row — is
 * observable in this environment. This asserts the DOM contract only.
 */
export const ClosedDrawerIsInert: Story = {
  args: { members: spreadMembers },
  play: async ({ canvas, canvasElement }) => {
    const trigger = canvas.getByRole('button', { name: 'Filters' });
    const region = canvasElement.ownerDocument.getElementById(
      trigger.getAttribute('aria-controls') as string,
    );
    await expect(region).toHaveAttribute('inert');

    await userEvent.click(trigger);
    await expect(region).not.toHaveAttribute('inert');
  },
};
