import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import UserLifecycleActions from './UserLifecycleActions';
import { mockUsers } from '../../../test/mocks/fixtures';
import type { OktaUser } from '../../../shared/types';

const user = (over: Partial<OktaUser> = {}): OktaUser => ({
  ...mockUsers[10],
  status: 'ACTIVE',
  ...over,
});

/** The Manage tier's body: the account-state verbs + their confirm modal (status-gated). */
const meta = {
  title: 'Users/UserLifecycleActions',
  component: UserLifecycleActions,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The **Manage tier's body** on the user-detail rung: the account-state verbs plus their " +
          'confirmation modal, gated by user status.\n\n' +
          'It lost its card. These used to be a `Lifecycle Actions` card of their own, stacked with ' +
          'the profile and the memberships as though "suspend this person" were a section of the ' +
          "page's content. It is not — it is a verb whose object is the whole page, so ADR-0030 puts " +
          'it in the `ActionBar`, one press away behind **Manage** (`UserActionBar`). ' +
          '**The `useUserLifecycleActions` state machine, every confirm modal and the status-driven ' +
          'gating are unchanged; only the placement moved.**\n\n' +
          'Reading order is deliberate: the non-destructive verbs first, a rule, then the destructive ' +
          'one alone on its own row with the consequence stated beside it. `Each asks to confirm` is ' +
          'stated once for the band rather than implied per button.\n\n' +
          'Offers only the actions valid for the current status — Reset password + Suspend for ' +
          'ACTIVE, Unsuspend for SUSPENDED, Reset password alone for RECOVERY / LOCKED_OUT / ' +
          'PASSWORD_EXPIRED, and a notice for DEPROVISIONED. Presentational: the parent owns the ' +
          'pending-action state and the API call.',
      },
    },
  },
  decorators: [
    (Story) => (
      // The band the tier-2 body renders into, so the story shows what ships.
      <div className="rounded-b-md border border-neutral-200 bg-white px-4 py-3">
        <Story />
      </div>
    ),
  ],
  args: {
    user: user(),
    isLifecycleLoading: false,
    pendingLifecycleAction: null,
    onRequestAction: fn(),
    onCancel: fn(),
    onConfirm: fn(),
  },
  argTypes: {
    user: { description: 'The selected user the actions apply to.' },
    isLifecycleLoading: {
      description: 'True while a confirmed action is in flight (disables the trigger buttons).',
    },
    pendingLifecycleAction: {
      description: 'The action awaiting confirmation, or null. Drives the confirm modal.',
    },
    onRequestAction: { description: 'Arm the confirm modal for an action.' },
    onCancel: { description: 'Dismiss the confirm modal without running the action.' },
    onConfirm: { description: 'Run the armed action (the confirm button).' },
  },
} satisfies Meta<typeof UserLifecycleActions>;

export default meta;
type Story = StoryObj<typeof meta>;

/** ACTIVE user: Reset password above the rule, Suspend user below it. */
export const Active: Story = {};

/** SUSPENDED user: the destructive row becomes the restorative one. */
export const Suspended: Story = {
  args: { user: user({ status: 'SUSPENDED' }) },
};

/** LOCKED_OUT user: Reset password only — there is no destructive row to rule off. */
export const LockedOut: Story = {
  args: { user: user({ status: 'LOCKED_OUT' }) },
};

/** DEPROVISIONED user: no actions available, just the notice. */
export const Deprovisioned: Story = {
  args: { user: user({ status: 'DEPROVISIONED' }) },
};

/** An action is in flight — the trigger buttons are disabled. */
export const Loading: Story = {
  args: { isLifecycleLoading: true },
};

/** The suspend action is armed — the confirmation modal is open. */
export const ConfirmingSuspend: Story = {
  args: { pendingLifecycleAction: 'suspend' },
};

/** The reset-password action is armed — the confirmation modal is open. */
export const ConfirmingResetPassword: Story = {
  args: { pendingLifecycleAction: 'resetPassword' },
};

/** The 360px floor: the consequence text and its button must wrap, not squeeze. */
export const Narrow: Story = {
  parameters: { viewport: { value: 'sidepanelCompact' } },
};
