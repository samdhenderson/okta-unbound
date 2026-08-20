import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import UserActionBar from './UserActionBar';
import { mockUsers } from '../../../test/mocks/fixtures';
import type { OktaUser } from '../../../shared/types';

const user = (over: Partial<OktaUser> = {}): OktaUser => ({
  ...mockUsers[10],
  status: 'ACTIVE',
  ...over,
});

/** The user-detail rung's two-tier action strip. */
const meta = {
  title: 'Users/UserActionBar',
  component: UserActionBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Every verb whose object is the whole user (ADR-0030) — but they are not equal, and a flat ' +
          'row of five buttons said they were.\n\n' +
          '**Tier 1** holds the verbs you reach for while reading: *Compare*, *Add to Group*, and ' +
          '*Manage*, which is not a verb at all but the disclosure for tier 2. **Tier 2** holds the ' +
          'account-state verbs. Suspending someone is one press further away than comparing them, ' +
          'which is the whole point of the tier — and `Each asks to confirm` is stated once for the ' +
          'band rather than implied per button.\n\n' +
          'The band **is** the bar rather than a card that appeared under it: it is `ActionBar`’s ' +
          '`expansion` slot, so it sits inside the strip, shares its chrome, docks with it, and opens ' +
          'by stretching the strip downward through the shared `.disclose` grid. Its contents stay ' +
          'mounted while closed, held out of the tab order and the accessible tree with `inert`.\n\n' +
          '**There is no Export button and no Clear sessions button, deliberately.** The Export tab ' +
          'has no user-scoped descriptor to open (`users` is whole-org; the `search-to-select` ' +
          'descriptors take a group or an app), and `useUserLifecycleActions` implements ' +
          '`suspend | unsuspend | resetPassword` and nothing else. A control that does nothing is ' +
          'worse than an absent one.\n\n' +
          'Gating is unchanged from the `Lifecycle Actions` card this replaced: Suspend for an ' +
          '`ACTIVE` user, Unsuspend for a `SUSPENDED` one, Reset password for the four statuses Okta ' +
          'accepts it for, and a notice instead of the band for `DEPROVISIONED`.',
      },
    },
  },
  args: {
    user: user(),
    onCompare: fn(),
    onAddToGroup: fn(),
    isLoadingMemberships: false,
    manageOpen: false,
    onToggleManage: fn(),
    isLifecycleLoading: false,
    pendingLifecycleAction: null,
    onRequestLifecycleAction: fn(),
    onCancelLifecycleAction: fn(),
    onConfirmLifecycleAction: fn(),
    // Nothing scrolls in a story, so the strip renders at its resting geometry.
    sticky: false,
  },
  argTypes: {
    user: { description: 'The user every verb in the strip acts on.' },
    onCompare: { description: 'Opens the comparison rung.' },
    onAddToGroup: { description: 'Opens the Add-to-Group modal.' },
    isLoadingMemberships: {
      description: 'True while memberships load — both tier-1 verbs need them, so both disable.',
    },
    manageOpen: {
      description: 'Whether tier 2 is showing. Owned by the tab, so a rung change collapses it.',
    },
    onToggleManage: { description: 'Toggles tier 2.' },
    isLifecycleLoading: { description: 'True while a confirmed lifecycle action is in flight.' },
    pendingLifecycleAction: { description: 'The action awaiting confirmation, or `null`.' },
    sticky: {
      description: 'Pin the strip below the header. `false` in stories — nothing scrolls.',
    },
  },
} satisfies Meta<typeof UserActionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Tier 1 only: the everyday verbs, with Manage closed. */
export const Default: Story = {};

/** Memberships are still loading, so Compare and Add to Group are both unavailable. */
export const LoadingMemberships: Story = {
  args: { isLoadingMemberships: true },
};

/** An ACTIVE user with Manage open: reset password above the rule, suspend below it. */
export const ManageOpenActive: Story = {
  args: { manageOpen: true },
};

/** A SUSPENDED user: the destructive row becomes the restorative one. */
export const ManageOpenSuspended: Story = {
  args: { manageOpen: true, user: user({ status: 'SUSPENDED' }) },
};

/** A DEPROVISIONED user: the band carries the notice rather than a row of disabled buttons. */
export const ManageOpenDeprovisioned: Story = {
  args: { manageOpen: true, user: user({ status: 'DEPROVISIONED' }) },
};

/** A lifecycle action is in flight — every verb in the band is disabled. */
export const ManageOpenLifecycleRunning: Story = {
  args: { manageOpen: true, isLifecycleLoading: true },
};

/** The suspend action is armed, so its confirmation modal is open. */
export const ConfirmingSuspend: Story = {
  args: { manageOpen: true, pendingLifecycleAction: 'suspend' },
};

/**
 * Manage is a real disclosure: `aria-expanded` flips and `aria-controls` points at
 * the band, so the region it reveals is reachable from the button that reveals it.
 */
export const ManageIsADisclosure: Story = {
  render: (args) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- a story render fn is a component
    const [open, setOpen] = useState(false);
    return <UserActionBar {...args} manageOpen={open} onToggleManage={() => setOpen(!open)} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const manage = canvas.getByRole('button', { name: 'Manage' });
    await expect(manage).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(manage);
    await expect(manage).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByRole('button', { name: /Suspend user/ })).toBeVisible();

    await userEvent.click(manage);
    await expect(manage).toHaveAttribute('aria-expanded', 'false');
  },
};

/**
 * The 360px floor with the band open — three tier-1 buttons plus a wrapping tier-2
 * band is exactly where a narrow panel breaks.
 */
export const NarrowManageOpen: Story = {
  args: { manageOpen: true },
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
